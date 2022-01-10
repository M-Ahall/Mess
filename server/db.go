package main

import (
	// External
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	// Standard
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
)

var (
	db *sqlx.DB
)

func dbConnect() {
	var err error

	dbConn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		config.Postgresql.Host,
		config.Postgresql.Port,
		config.Postgresql.User,
		config.Postgresql.Pass,
		config.Postgresql.Name,
	)

	db, err = sqlx.Connect("postgres", dbConn)
	if err != nil {
		panic(err)
	}
}

func dbLogin(username, password string) (token string, err error) {
	var rows *sql.Rows
	rows, err = db.Query(`
		SELECT token
		FROM "user"
		WHERE
			"username" = $1 AND
			"password" = ENCODE(
				SHA256(
					CONCAT(salt, $2::varchar)::bytea
				),
				'hex'
			) AND
			"active"
		`,
		username,
		password,
	)
	if err != nil {
		return
	}
	if rows.Next() {
		err = rows.Scan(&token)
	}
	rows.Close()

	// We update last login to be able to throw users out after a specified time.
	rows, err = db.Query(`
		UPDATE "user"
		SET
			last_login = NOW()
		WHERE
			"username" = $1
		`,
		username,
	)
	if err != nil {
		return
	}
	rows.Close()
	return
}
func dbAuthenticate(token string) (userId int, username string, admin bool, err error) {
	var rows *sql.Rows
	rows, err = db.Query(`
		SELECT id, username, admin
		FROM "user"
		WHERE
			token = $1 AND
			"active"
		`,
		token,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	if rows.Next() {
		err = rows.Scan(&userId, &username, &admin)
	}
	return
}
func dbGroups(groupId int) (groups map[int]*Group, err error) {
	var rows *sqlx.Rows
	var query string
	var args []interface{}

	if query, args, err = sqlx.In(`
		SELECT
			group_id           AS GroupId,
			group_name         AS GroupName,
			system_id          AS SystemId,
			system_name        AS SystemName,
			system_comments    AS SystemComments,
			unseen_log_entries AS UnseenEntries
		FROM groups_and_systems
		WHERE
			CASE
				WHEN $1 = 0 THEN true
				ELSE group_id = $1
			END
		ORDER BY
			group_name ASC,
			system_name ASC
		`,
		groupId,
	); err != nil { return }
	query = db.Rebind(query)
	rows, err = db.Queryx(query, args...)
	if err != nil { return }
	defer rows.Close()

	groups = make(map[int]*Group)
	for rows.Next() {
		row := struct{
			GroupId        int
			GroupName      string
			SystemId       sql.NullInt64
			SystemName     sql.NullString
			SystemComments sql.NullString
			UnseenEntries  int
		}{}
		if err = rows.StructScan(&row); err != nil { return }

		// Create the group first time we see it
		if _, found := groups[row.GroupId]; !found {
			groups[row.GroupId] = &Group{
				Id: row.GroupId,
				Name: row.GroupName,
				Systems: []System{},
			}
		}

		// Groups without systems get null columns here.
		if !row.SystemId.Valid { continue }
		system := System{
			Id: int(row.SystemId.Int64),
			Name: row.SystemName.String,
			Comments: row.SystemComments.String,
			UnseenEntries: row.UnseenEntries,
		}

		if group, ok := groups[row.GroupId]; ok {
			group.Systems = append(
				group.Systems,
				system,
			)
		}
	}

	return
}
func dbCreateGroup(name string) (group Group, err error) {
	finalName := strings.TrimSpace(name)
	if finalName == "" {
		err = fmt.Errorf("Group name can not be blank")
		return
	}

	var rows *sql.Rows
	rows, err = db.Query(`
		INSERT INTO "group"(name)
		VALUES($1)
		RETURNING id, name;
		`,
		finalName,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	rows.Next();
	err = rows.Scan(&group.Id, &group.Name)
	group.Systems = []System{}
	return
}
func dbDeleteGroup(groupId int) (group Group, err error) {
	var rows *sql.Rows
	rows, err = db.Query(`
		DELETE FROM "group"
		WHERE
			id = $1
		RETURNING id, name
		`,
		groupId,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	rows.Next();
	err = rows.Scan(
		&group.Id,
		&group.Name,
	)
	return
}
func dbRenameGroup(groupId int, name string) (group Group, err error) {
	finalName := strings.TrimSpace(name)
	if finalName == "" {
		err = fmt.Errorf("Group name can not be blank")
		return
	}

	var rows *sql.Rows
	var groups map[int]*Group
	rows, err = db.Query(`
		UPDATE "group"
		SET
			name = $1
		WHERE
			id = $2
		`,
		name,
		groupId,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	groups, err = dbGroups(groupId)
	if getGroup, ok := groups[groupId]; ok {
		group = *getGroup
	}

	return
}

func dbSystemEntries(systemId int) (entries []*LogEntry, err error) {
	var rows *sqlx.Rows
	var entry *LogEntry
	var query string
	var args []interface{}

	if query, args, err = sqlx.In(`
		SELECT
			id,
			system_id,
			"time",
			"type",
			"context",
			"data",
			viewed,
			backtrace,
			important,
			remote_host
		FROM "log"
		WHERE
			system_id = $1
		ORDER BY
			"time" ASC,
			id ASC
		`, systemId,
	); err != nil { return }
	query = db.Rebind(query)
	rows, err = db.Queryx(query, args...)
	defer rows.Close()

	for rows.Next() {
		entry = new(LogEntry)
		if err = rows.StructScan(entry); err != nil { return }
		entries = append(entries, entry)
	}

	return
}
func dbAddLog(entry *LogEntry) error {
	var data []byte
	var err error

	if entry.DataBase64 {
		data, err = base64.StdEncoding.DecodeString(entry.Data)
		if err != nil {
			return err
		}
	} else {
		data = []byte(entry.Data)
	}

	rows, err := db.Query(`
		INSERT INTO "log"(
			system_id,
			"type",
			"context",
			"data",
			viewed,
			backtrace,
			remote_host
		)
		VALUES($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, "time";
		`,
		entry.SystemId,
		entry.Type,
		entry.Context,
		data,
		entry.Type == "SEPARATOR", // always viewed to not screw up
		                           // displayed count.
		entry.Backtrace,
		entry.RemoteHost,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	rows.Next();
	if err = rows.Scan(&entry.Id, &entry.Time); err != nil {
		return err
	}
	return nil
}
func dbSeenEntry(entry *LogEntry) (err error) {
	var rows *sqlx.Rows
	var query string
	var args []interface{}

	if query, args, err = sqlx.In(`
		UPDATE "log"
		SET viewed=true
		WHERE
			id=$1
		RETURNING *
		`, entry.Id,
	); err != nil {
		return err
	}
	query = db.Rebind(query)
	if rows, err = db.Queryx(query, args...); err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		if err = rows.StructScan(entry); err != nil { return }
	}
	return
}
func dbImportantState(entry *LogEntry) (err error) {
	var rows *sqlx.Rows
	var query string
	var args []interface{}

	if query, args, err = sqlx.In(`
		UPDATE "log"
		SET important=$2
		WHERE
			id=$1
		RETURNING *
		`,
		entry.Id,
		entry.Important,
	); err != nil {
		return err
	}
	query = db.Rebind(query)
	if rows, err = db.Queryx(query, args...); err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		if err = rows.StructScan(entry); err != nil { return }
	}
	return
}
func dbEntryDelete(entry *LogEntry) (err error) {
	var rows *sqlx.Rows
	var query string
	var args []interface{}

	if query, args, err = sqlx.In(`
		DELETE FROM "log"
		WHERE
			id=$1 AND
			NOT important
		RETURNING *
		`, entry.Id,
	); err != nil {
		return err
	}
	query = db.Rebind(query)
	if rows, err = db.Queryx(query, args...); err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		if err = rows.StructScan(entry); err != nil { return }
	}
	return
}

func dbCreateSystem(groupId int, name string) (system System, err error) {
	finalName := strings.TrimSpace(name)
	if finalName == "" {
		err = fmt.Errorf("System name can not be blank")
		return
	}

	var rows *sql.Rows
	rows, err = db.Query(`
		INSERT INTO "system"(group_id, name)
		VALUES($1, $2)
		RETURNING id, name;
		`,
		groupId,
		name,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	rows.Next();
	err = rows.Scan(&system.Id, &system.Name)
	return
}
func dbDeleteSystem(systemId int) (system System, groupId int, err error) {
	var rows *sql.Rows
	rows, err = db.Query(`
		DELETE FROM "system"
		WHERE
			id = $1
		RETURNING id, name, comments, group_id
		`,
		systemId,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	rows.Next();
	err = rows.Scan(
		&system.Id,
		&system.Name,
		&system.Comments,
		&groupId,
	)
	return
}
func dbRenameSystem(systemId int, name string) (system System, groupId int, err error) {
	finalName := strings.TrimSpace(name)
	if finalName == "" {
		err = fmt.Errorf("System name can not be blank")
		return
	}

	var rows *sql.Rows
	rows, err = db.Query(`
		UPDATE "system"
		SET
			name = $1
		WHERE
			id = $2
		RETURNING id, name, comments, group_id
		`,
		name,
		systemId,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	rows.Next();
	err = rows.Scan(
		&system.Id,
		&system.Name,
		&system.Comments,
		&groupId,
	)
	return
}

func dbUsers() (users []User, err error) {
	var rows *sqlx.Rows
	var query string
	var args []interface{}
	if query, args, err = sqlx.In(`
		SELECT
			id,
			Username,
			password,
			salt,
			token,
			last_login,
			active, admin
		FROM public."user"
		ORDER BY
			username ASC
		`,
	); err != nil { return }
	query = db.Rebind(query)
	rows, err = db.Queryx(query, args...)
	if err != nil { return }
	defer rows.Close()

	for rows.Next() {
		user := User{}
		if err = rows.StructScan(&user); err != nil { return }
		users = append(users, user)
	}
	return
}

// vim: foldmethod=syntax foldnestmax=1
