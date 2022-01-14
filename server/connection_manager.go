package main

import (
	// Standard
	"fmt"
	"net/http"
)

type ConnectionManager struct {
	connections map[string]*WsConnection
	broadcastQueue chan interface{}
}

func NewConnectionManager() (cm ConnectionManager) {
	cm.connections = make(map[string]*WsConnection)
	cm.broadcastQueue = make(chan interface{}, 65536)
	return
}

// NewConnection creates a new connection, which is assigned a UUIDv4 for
// identification. This is then put into the connection collection.
func (cm *ConnectionManager) NewConnection(w http.ResponseWriter, r *http.Request) (*WsConnection) {
	wsConn, err := NewWsConnection(cm, w, r)
	if err != nil {
		wsConn.log("upgrade", "%s", err)
		return nil
	}

	// Keep track of all connections.
	cm.connections[wsConn.UUID] = &wsConn

	// Successfully upgraded to a websocket connection.
	wsConn.log("connected", "")

	return &wsConn
}

// Prune closes an deletes connections. If this happened to be non-fatal, the
// user will just have to reconnect.
func (cm *ConnectionManager) Prune(wsConn *WsConnection, err error) {
	wsConn.log("error", "%s", err)
	wsConn.Close()
	delete(cm.connections, wsConn.UUID)
}

func (cm *ConnectionManager) Read(wsConn *WsConnection) ([]byte, bool) {
	var err error
	var requestData []byte
	_, requestData, err = wsConn.Conn.ReadMessage()
	if err != nil {
		cm.Prune(wsConn, err)
		return nil, false
	}
	return requestData, true
}
func (cm *ConnectionManager) Send(wsConn *WsConnection, msg interface{}) (ok bool) {
	err := wsConn.Conn.WriteJSON(msg)
	if err != nil {
		cm.Prune(wsConn, err)
		return false
	}
	return true
}

func (cm *ConnectionManager) Broadcast(msg interface{}) {
	cm.broadcastQueue <- msg
}
func (cm *ConnectionManager) BroadcastLoop() {
	for {
		msg := <-cm.broadcastQueue
		for _, wsConn := range cm.connections {
			cm.Send(wsConn, msg)
		}
	}
}

func (cm *ConnectionManager) Kill(userId int) {
	for _, wsConn := range cm.connections {
		if wsConn.UserId == userId {
			cm.Prune(wsConn, fmt.Errorf("Connection killed"))
		}
	}
}

// vim: foldmethod=syntax foldnestmax=1
