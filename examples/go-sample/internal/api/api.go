package api

import "example.com/gosample/internal/store"

type Server struct {
	store *store.Store
}

func NewServer() *Server {
	return &Server{store: store.New()}
}

func (srv *Server) Handle(req string) string {
	if req == "ping" {
		return "pong"
	}
	return srv.store.Get(req)
}
