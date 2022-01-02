CREATE TABLE public."user" (
	id         serial4      NOT NULL,
	username   varchar(128) NOT NULL,
	password   varchar(128) NOT NULL,
	salt       char(32)     NOT NULL,
	token      char(36)     NOT NULL,
	last_login timestamp    NOT NULL DEFAULT '1970-01-01 00:00:00'::timestamp without time zone,
	active     bool         NOT NULL DEFAULT true,

	CONSTRAINT user_pk PRIMARY KEY (id),
	CONSTRAINT user_un UNIQUE (username)
);

CREATE TABLE public."group" (
	id     serial4      NOT NULL,
	"name" varchar(128) NOT NULL,

	CONSTRAINT group_pk PRIMARY KEY (id)
);

CREATE TABLE public."system" (
	id       serial4      NOT NULL,
	"name"   varchar(128) NOT NULL,
	comments text         NOT NULL DEFAULT ''::text,
	group_id int4         NOT NULL,

	CONSTRAINT system_pk PRIMARY KEY (id),
	CONSTRAINT system_fk FOREIGN KEY (group_id) REFERENCES public."group"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.log (
	id        serial4      NOT NULL,
	system_id int4         NOT NULL,
	"time"    timestamp    NOT NULL DEFAULT now(),
	"type"    varchar(256) NOT NULL DEFAULT 'LOG'::character varying,
	context   varchar(256) NOT NULL DEFAULT ''::character    varying,
	"data"    text         NOT NULL DEFAULT ''::text,
	backtrace text         NOT NULL DEFAULT ''::text,
	viewed    bool         NOT NULL DEFAULT false,
	important bool         NOT NULL DEFAULT false,

	CONSTRAINT log_pk PRIMARY KEY (id),
	CONSTRAINT log_fk FOREIGN KEY (system_id) REFERENCES public."system"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE VIEW groups_and_systems AS
	SELECT
		g.id AS group_id,
		g.name AS group_name,
		s.id AS system_id,
		s.name AS system_name,
		s.comments AS system_comments,
		COUNT(l.id) FILTER(WHERE NOT l.viewed) AS unseen_log_entries
	FROM "group" g
	LEFT JOIN "system" s ON s.group_id = g.id
	LEFT JOIN "log" l ON l.system_id = s.id
	GROUP BY
		g.id, s.id, l.system_id;

INSERT INTO public."user"(username, salt, password, token, active)
VALUES(
	'admin',
	'71681feebdc40ebf7c2a2ab99a32959d',
	'ea94293a035745ee6fc59f4b96d7b8fb129696023fbaad9dde215b0a584e0518',
	'95e09e2e-2bc9-4ca7-bbfe-211577b02473',
	true
);
