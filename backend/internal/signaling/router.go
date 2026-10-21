package signaling

import (
	"crypto/subtle"
	"github.com/gorilla/websocket"
	"net/http"
	"regexp"
	"sync"
	"time"
	"webdrop/internal/hub"
)

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
var validToken = regexp.MustCompile(`^[a-f0-9]{64}$`)
var validID = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,80}$`)

type entry struct {
	room  *hub.Room
	users int
	token string
}
type Router struct {
	mu    sync.Mutex
	rooms map[string]*entry
}

func NewRouter() *Router { return &Router{rooms: make(map[string]*entry)} }
func (s *Router) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	roomID, peerID := r.URL.Query().Get("room"), r.URL.Query().Get("peer")
	token := r.URL.Query().Get("auth")
	if !validToken.MatchString(token) {
		http.Error(w, "Room capability required", http.StatusUnauthorized)
		return
	}
	if !validID.MatchString(roomID) || !validID.MatchString(peerID) {
		http.Error(w, "Invalid room or peer ID", 400)
		return
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	s.mu.Lock()
	e := s.rooms[roomID]
	if e == nil {
		e = &entry{room: hub.NewRoom(), token: token}
		s.rooms[roomID] = e
	}
	if subtle.ConstantTimeCompare([]byte(e.token), []byte(token)) != 1 {
		s.mu.Unlock()
		conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "Invite key does not match this room"), time.Now().Add(time.Second))
		conn.Close()
		return
	}
	e.users++
	s.mu.Unlock()
	release := func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		e.users--
		if e.users == 0 {
			delete(s.rooms, roomID)
		}
	}
	client := hub.NewClient(e.room, conn, peerID, roomID)
	if !e.room.Register(client) {
		conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "Room full or peer ID already connected"), time.Now().Add(time.Second))
		conn.Close()
		release()
		return
	}
	go client.WritePump()
	go func() { defer release(); client.ReadPump() }()
}

func (s *Router) Close() {
	s.mu.Lock()
	rooms := make([]*hub.Room, 0, len(s.rooms))
	for _, e := range s.rooms {
		rooms = append(rooms, e.room)
	}
	s.mu.Unlock()
	for _, room := range rooms {
		room.Close()
	}
}
