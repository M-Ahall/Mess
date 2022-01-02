package main

import (
	// Standard
	"fmt"
	"net/http"
	"strings"
)

func log(format string, params ...interface{}) {
	fmt.Printf(format, params...)
}

func (conn WsConnection) log(typ, format string, params ...interface{}) {
	fmt.Printf("%-15s [ %36s ] %13s | ", conn.RemoteHost, conn.UUID, typ)
	fmt.Printf(format+"\n", params...)
}

func logRequest(r *http.Request, typ, format string, params ...interface{}) {
	// Remote IP address of the connection.
	// Using X-Forwarded-For header if behind web proxy.
	var remoteHost string
	forwardHeader := r.Header.Get("X-Forwarded-For")
	if forwardHeader != "" {
		remoteHost = forwardHeader
	} else {
		// Port isn't necessary.
		components := strings.Split(r.RemoteAddr, ":")
		remoteHost = components[0]
	}

	fmt.Printf(
		"%-15s [ %36s ] %13s | ",
		remoteHost,
		"",
		typ,
	)
	fmt.Printf(format+"\n", params...)
}
