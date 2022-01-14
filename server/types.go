package main

type User struct {
	Id        int
	Username  string
	Password  string `json:"-"`
	Salt      string `json:"-"`
	Token     string `json:"-"`
	LastLogin string `db:"last_login"`
	Active    bool
	Admin     bool
}

type Group struct {
	Id   int
	Name string
	Systems []System
}

type System struct {
	Id            int
	Name          string
	Comments      string
	UnseenEntries int
}

type LogEntry struct {
	Id         int `json:",omitempty"`
	SystemId   int `db:"system_id"`
	Time       string
	Type       string
	Context    string
	Data       string
	DataBase64 bool
	Viewed     bool
	Backtrace  string
	Important  bool
	RemoteHost string `db:"remote_host"`
}

// A client request, parsed first to know how to
// decode the message.
type ClientRequest struct {
	Op        string
	RequestId string
}

// Common response parameters.
type ClientResponse struct {
	Op        string
	RequestId string `json:",omitempty"`
	Error     string `json:",omitempty"`
	Data      interface{}
}

/* Login request - username and password to receive an authentication token
 * that is more harmless to have in browser storage, and can be invalidated
 * after a certain time to force relogin. */
type LoginRequest struct {
	Username string
	Password string
}

type LoginResponse struct {
	Token string
}

// Authentication request - using the token to gain access to other ops.
type AuthenticationRequest struct {
	Token string
}

type AuthenticationResponse struct {
	Ok bool
}

// Answer to a request for groups.
type GroupsResponse struct {
	Groups map[int]*Group
}

// Broadcasts new log entries.
type LogEntryPush struct {
	Entry LogEntry
}

// Requests all entries from a system.
type SystemEntriesRequest struct {
	SystemId int
}

type SystemEntriesResponse struct {
	SystemId   int
	LogEntries []*LogEntry
}

// An entry is marked as seen.
type SeenEntryRequest struct {
	EntryId int
}

type SeenEntryPush struct {
	Entry LogEntry
}

// Deletes an entry.
type DeleteEntryRequest struct {
	ClientRequest
	EntryId int
}

type DeleteEntryPush struct {
	Entry LogEntry
}

// Sets the important state on entries.
type ImportantStateRequest struct {
	ClientRequest
	EntryId int
	IsImportant bool
}

type ImportantStatePush struct {
	Entry LogEntry
}

// Create a group.
type CreateGroupRequest struct {
	Name string
}

type CreateGroupPush struct {
	Group Group
}

// Delete a group.
type DeleteGroupRequest struct {
	GroupId int
}

type DeleteGroupPush struct {
	Group Group
}

// Rename a group.
type RenameGroupRequest struct {
	GroupId int
	Name string
}

type RenameGroupPush struct {
	Group Group
}

// Create a system.
type CreateSystemRequest struct {
	GroupId int
	Name string
}

type CreateSystemPush struct {
	GroupId int
	System System
}

// Deletes a system.
type DeleteSystemRequest struct {
	SystemId int
}

type DeleteSystemPush struct {
	GroupId int
	System System
}

// Renames a system.
type RenameSystemRequest struct {
	SystemId int
	Name     string
}

type RenameSystemPush struct {
	GroupId int
	System System
}

// Retrieves a list of users.
type UsersResponse struct {
	Users []User
}

// Creates a new user.
type CreateUserRequest struct {
	Username string
}

type NewUserPush struct {
	User User
}

// Updates a user.
type UpdateUserRequest struct {
	UserId int
	Password string
	Active bool
	Admin bool
}

type UpdateUserPush struct {
	User User
}

// Removes a user.
type RemoveUserRequest struct {
	UserId int
}

type RemoveUserPush struct {
	UserId int
}

// Force a logout/login for a user
type LogoutUserRequest struct {
	UserId int
}

type LogoutUserResponse struct {
	UserId int
}
