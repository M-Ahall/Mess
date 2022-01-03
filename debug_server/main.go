package main

import (
	// Standard
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const VERSION = "0.1.0";

func main() {
	fmt.Printf("Debug Websocket Server %s\n", VERSION)

	// Connect to PostgreSQL database.
	dbConnect()

	// The Connection Manager handles all outgoing communication to have a
	// single point where we can make sure dead connections are pruned.
	connectionManager := NewConnectionManager()

	// ws endpoint handles all client requests via JSON.
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		var err error

		// New connection is added to the connection collection.
		wsConn := connectionManager.NewConnection(w, r)
		if wsConn == nil {
			return
		}

		// Listen for incoming client requests.
		var resp ClientResponse
		var bcast ClientResponse
		var ok bool
		var requestData []byte
		for {
			requestData, ok = connectionManager.Read(wsConn)
			// !ok is a communication error, this loop can be closed.
			if !ok { return }

			/* Parse the incoming request and respond with either
			 * a direct response to this connection, or with a
			 * broadcast. Or possibly both. */
			resp, bcast, err = wsConn.HandleRequest(requestData)

			/* err is application error, not communication error.
			 * Thus we will notify user of error, and then continue
			 * the loop. */
			if err != nil {
				resp.Error = err.Error()
				wsConn.log("error", "%s", err)

				ok = connectionManager.Send(wsConn, resp)
				if !ok { return }
				continue
			}

			// The Data field contains the specific response data
			// for the request. Without it, no response.
			if(resp.Data != nil) {
				ok = connectionManager.Send(wsConn, resp)
				if !ok { return }
			}

			// Broadcasts are considered not empty when their op is
			// set.
			if(bcast.Op != "") {
				connectionManager.Broadcast(bcast)
			}
		}
	})

	http.HandleFunc("/log", func(w http.ResponseWriter, r *http.Request) {
		var err error
		var logEntry LogEntry
		var body []byte

		// Get host sending log to us.
		forwardHeader := r.Header.Get("X-Forwarded-For")
		if forwardHeader != "" {
			logEntry.RemoteHost = forwardHeader
		} else {
			// Port isn't necessary.
			components := strings.Split(r.RemoteAddr, ":")
			logEntry.RemoteHost = components[0]
		}

		// Read request body and parse.
		body, err = io.ReadAll(r.Body)
		if err != nil {
			logRequest(r, "body", "%s", err)
			return
		}
		err = json.Unmarshal(body, &logEntry)
		if err != nil {
			logRequest(r, "parse", "%s", err)
			return
		}

		// Store log in database.
		err = dbAddLog(&logEntry)
		if err != nil {
			logRequest(r, "log", "%s", err)

			out, _ := json.Marshal(ClientResponse{
				Op: "log",
				Error: err.Error(),
			})
			w.Write(out)
			return
		}

		// Log to console.
		logRequest(
			r,
			"log",
			"system id: %6d, %s, %s",
			logEntry.SystemId,
			logEntry.Type,
			logEntry.Context,
		)

		// Display
		msg := ClientResponse{
			Op: "LogEntry",
			Data: LogEntryPush{
				Entry: logEntry,
			},
		}
		connectionManager.Broadcast(msg)
	})

	listen := fmt.Sprintf("%s:%d", config.Server.Host, config.Server.Port)
	fmt.Printf("Listening on %s\n\n", listen)
	http.ListenAndServe(listen, nil)
}
