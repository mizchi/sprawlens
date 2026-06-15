package main

import (
	"fmt"

	"example.com/gosample/internal/api"
)

func main() {
	srv := api.NewServer()
	fmt.Println(srv.Handle("ping"))
}
