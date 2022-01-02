package main

import (
	"github.com/go-yaml/yaml"

	"errors"
	"fmt"
	"io/ioutil"
	"os"
)

var (
	config *Config
)

func init() {
	config = new(Config)

	if cerr := Parse(); cerr != nil {
		fmt.Printf(
			"\x1b[31mError reading config file\x1b[0m\n%s\n\n",
			cerr,
		)

		fmt.Printf(
			"\x1b[32mConfiguration template\x1b[0m\n---\n%s\n",
			cerr.Template,
		)
		os.Exit(1)
	}
}

type Config struct {
	Log struct {
		RequestData bool
	}

	Web struct {
		Host   string
		Port   int
		Domain string
	}

	Postgresql struct {
		Host string
		Port int16
		User string
		Pass string
		Name string
	}
}

type ConfigBroker struct {
}

type ConfigError struct {
	Err      error
	Template []byte
}
func (c *ConfigError) Error() (string) {
	return c.Err.Error()
}

func Parse() (err *ConfigError) {
	err = new(ConfigError)

	var home string
	if home = os.Getenv("HOME"); home == "" {
		err.Err = errors.New("Env variable HOME is not set")
		return
	}
	filename := fmt.Sprintf("%s/.config/debug_server/config.yaml", home)

	template := new(Config)
	template.Log.RequestData = true
	template.Web.Host = "127.0.0.1"
	template.Web.Port = 9001
	template.Web.Domain = "example.com"
	template.Postgresql.Host = "127.0.0.1"
	template.Postgresql.Port = 5432
	template.Postgresql.User = "postgres"
	template.Postgresql.Name = "portal"

	yamlFromFile, ferr := ioutil.ReadFile(filename)
	if ferr != nil {
		err.Err = ferr
		err.Template, _ = yaml.Marshal(template)
		return
	}

	if yerr := yaml.UnmarshalStrict(yamlFromFile, config); yerr != nil {

		terr := new(ConfigError)
		terr.Err = yerr
		terr.Template, _ = yaml.Marshal(template)
		err = terr
		return
	}

	err = nil
	return
}
