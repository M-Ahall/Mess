package main

import (
	// External
	"github.com/gorilla/websocket"
	"github.com/google/uuid"

	// Standard
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

var (
	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,

		// CheckOrigin is to match DOMAIN constant.
		// Use X-Forwarded-Server if behind proxy.
		CheckOrigin: validateOrigin,
	}
)

func init() {
	// Faster UUID generation.
	uuid.EnableRandPool()
}

type WsConnection struct {
	UUID string
	UserId int
	Username string
	Admin bool
	Conn *websocket.Conn
	RemoteHost string
}

func validateOrigin(r *http.Request) bool {
	host := r.Header.Get("X-Forwarded-Server")
	if host == "" {
		components := strings.Split(r.Host, ":")
		host = components[0]
	}
	return host == config.CORS.OriginDomain
}
func NewWsConnection(w http.ResponseWriter, r *http.Request) (conn WsConnection, err error) {
	var newUUID uuid.UUID

	// UUIDs are used to identify the connection.
	newUUID, _ = uuid.NewRandom()
	conn.UUID = newUUID.String()
	conn.UserId = 0
	conn.Username = ""

	// Remote IP address of the connection.
	// Using X-Forwarded-For header if behind web proxy.
	forwardHeader := r.Header.Get("X-Forwarded-For")
	if forwardHeader != "" {
		conn.RemoteHost = forwardHeader
	} else {
		// Port isn't necessary.
		components := strings.Split(r.RemoteAddr, ":")
		conn.RemoteHost = components[0]
	}

	// Connection is upgraded to a websocket connection.
	conn.Conn, err = upgrader.Upgrade(w, r, nil)
	return
}

func (wsConn WsConnection) Authenticated() bool {
	return wsConn.UserId > 0
}
func (wsConn WsConnection) Close() {
	wsConn.Conn.Close()
}
func (wsConn *WsConnection) HandleRequest(requestData []byte) (resp ClientResponse, bcast ClientResponse, err error) {
	// clientRequest only cares about "Op", which then
	// determines the next structure to be parsed.
	clientRequest := new(ClientRequest)
	if err = json.Unmarshal(requestData, clientRequest); err != nil {
		return
	}

	// Request logging.
	if config.Log.RequestData {
		wsConn.log(
			clientRequest.Op,
			"%s",
			strings.TrimSpace(string(requestData)),
		);
	} else {
		wsConn.log(clientRequest.Op, "");
	}

	// When a response to a request is made, request op and id is mirrored.
	resp.RequestId = clientRequest.RequestId
	resp.Op = clientRequest.Op

	// Only two ops is allowed unauthenticated - authentication ops.
	if clientRequest.Op == "Login" {
		data := LoginResponse{}
		resp.Data = &data
		var token string
		req := new(LoginRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		token, err = dbLogin(req.Username, req.Password)
		if err != nil { return }
		data.Token = token
		return
	}

	if clientRequest.Op == "Authenticate" {
		data := AuthenticationResponse{}
		resp.Data = &data
		var userId int
		var username string
		var admin bool
		req := new(AuthenticationRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		userId, username, admin, err = dbAuthenticate(req.Token)
		if err != nil { return }
		wsConn.UserId = userId
		wsConn.Username = username
		wsConn.Admin = admin
		data.Ok = wsConn.Authenticated()
		return
	}

	// At this point, the connection has to be authenticated.
	if !wsConn.Authenticated() {
		err = fmt.Errorf("The connection is not authenticated")
		return
	}

	switch(clientRequest.Op) {
	case "Groups":
		data := GroupsResponse{}
		resp.Data = &data
		if data.Groups, err = dbGroups(0); err != nil { return }

	case "SystemEntries":
		data := SystemEntriesResponse{}
		resp.Data = &data
		req := new(SystemEntriesRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		data.SystemId = req.SystemId
		data.LogEntries, err = wsConn.SystemEntries(req.SystemId)
		if err != nil {
			return
		}

	case "SeenEntry":
		req := new(SeenEntryRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		entry := LogEntry{
			Id: req.EntryId,
		}
		if err = dbSeenEntry(&entry); err != nil { return }

		// dbSeenEntry will only update rows not already viewed.
		// entry will be overwritten with empty values in that case.
		if entry.Id > 0 {
			bcast.Op = "BroadcastSeenEntry"
			bcast.Data = SeenEntryPush{
				Entry: entry,
			}
		}

	case "DeleteEntry":
		req := new(DeleteEntryRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		entry := LogEntry{
			Id: req.EntryId,
		}
		if err = dbEntryDelete(&entry); err != nil { return }
		// dbEntryDelete will only delete rows not important.
		// entry will be overwritten with empty values in that case.
		if entry.SystemId > 0 {
			bcast.Op = "BroadcastEntryDeleted"
			bcast.Data = DeleteEntryPush{
				Entry: entry,
			}
		}

	case "SetImportant":
		req := new(ImportantStateRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		entry := LogEntry{
			Id: req.EntryId,
			Important: req.IsImportant,
		}
		if err = dbImportantState(&entry); err != nil { return }
		bcast.Op = "BroadcastEntryImportantState"
		bcast.Data = ImportantStatePush{
			Entry: entry,
		}

	case "CreateGroup":
		var group Group
		req := new(CreateGroupRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		if group, err = dbCreateGroup(req.Name); err != nil { return }
		bcast.Op = "BroadcastGroupCreated"
		bcast.Data = CreateGroupPush{
			Group: group,
		}

	case "DeleteGroup":
		var group Group
		req := new(DeleteGroupRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		if group, err = dbDeleteGroup(req.GroupId); err != nil { return }
		bcast.Op = "BroadcastGroupDeleted"
		bcast.Data = DeleteGroupPush{
			Group: group,
		}

	case "RenameGroup":
		var group Group
		req := new(RenameGroupRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		group, err = dbRenameGroup(req.GroupId, req.Name)
		if err != nil {
			return
		}
		bcast.Op = "BroadcastGroupRenamed"
		bcast.Data = RenameGroupPush{
			Group: group,
		}

	case "CreateSystem":
		var system System
		req := new(CreateSystemRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		system, err = dbCreateSystem(req.GroupId, req.Name)
		if err != nil {
			return
		}
		bcast.Op = "BroadcastSystemCreated"
		bcast.Data = CreateSystemPush{
			GroupId: req.GroupId,
			System: system,
		}

	case "DeleteSystem":
		var system System
		var groupId int
		req := new(DeleteSystemRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		system, groupId, err = dbDeleteSystem(req.SystemId)
		if err != nil {
			return
		}
		bcast.Op = "BroadcastSystemDeleted"
		bcast.Data = DeleteSystemPush{
			GroupId: groupId,
			System: system,
		}

	case "RenameSystem":
		var system System
		var groupId int
		req := new(RenameSystemRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		system, groupId, err = dbRenameSystem(req.SystemId, req.Name)
		if err != nil {
			return
		}
		bcast.Op = "BroadcastSystemRenamed"
		bcast.Data = RenameSystemPush{
			GroupId: groupId,
			System: system,
		}


	case "Users":
		if !wsConn.Admin {
			err = fmt.Errorf("Login with an admin account first.")
			return
		}
		data := UsersResponse{}
		resp.Data = &data
		data.Users, err = dbUsers()

	case "CreateUser":
		var user User
		if !wsConn.Admin {
			err = fmt.Errorf("Login with an admin account first.")
			return
		}
		req := new(CreateUserRequest)
		if err = json.Unmarshal(requestData, req); err != nil { return }
		user, err = dbCreateUser(req.Username)
		if err != nil { return }
		bcast.Op = "BroadcastUserCreated"
		bcast.Data = NewUserPush{
			User: user,
		}

	default:
		wsConn.log("request", "unknown: %s", clientRequest.Op)
		err = fmt.Errorf("Unknown op '%s'", clientRequest.Op)
		return
	}

	return
}
func (wsConn WsConnection) SystemEntries(sysId int) (entries []*LogEntry, err error) {
	if entries, err = dbSystemEntries(sysId); err != nil { return }

	// Data is encoded base64 as it could potentially contain binary data.
	for _, entry := range entries {
		entry.Data = base64.StdEncoding.EncodeToString([]byte(entry.Data))
		entry.DataBase64 = true
	}

	return
}


// vim: foldmethod=syntax foldnestmax=1
