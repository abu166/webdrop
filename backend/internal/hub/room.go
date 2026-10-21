package hub

import (
	"encoding/json"
	"sync"
)

type Room struct {
	mu      sync.RWMutex
	clients map[string]*Client
}

func NewRoom() *Room { return &Room{clients: make(map[string]*Client)} }
func (r *Room) Register(c *Client) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.clients[c.id]; exists || len(r.clients) >= 16 {
		return false
	}
	peers := []string{}
	for id := range r.clients {
		peers = append(peers, id)
	}
	welcome, _ := json.Marshal(map[string]any{"type": "welcome", "peers": peers})
	c.send <- welcome
	joined, _ := json.Marshal(map[string]string{"type": "peer-joined", "from": c.id})
	for _, peer := range r.clients {
		select {
		case peer.send <- joined:
		default:
			go peer.conn.Close()
		}
	}
	r.clients[c.id] = c
	return true
}
func (r *Room) Unregister(c *Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.clients[c.id] != c {
		return
	}
	delete(r.clients, c.id)
	close(c.send)
	msg, _ := json.Marshal(map[string]string{"type": "peer-left", "from": c.id})
	for _, peer := range r.clients {
		select {
		case peer.send <- msg:
		default:
			go peer.conn.Close()
		}
	}
}
func (r *Room) Broadcast(message []byte, ignoreClient *Client) {
	var envelope struct {
		To string `json:"to"`
	}
	if json.Unmarshal(message, &envelope) != nil {
		return
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, peer := range r.clients {
		if peer != ignoreClient && (envelope.To == "" || envelope.To == peer.id) {
			select {
			case peer.send <- message:
			default:
				go peer.conn.Close()
			}
		}
	}
}

// Close disconnects active sockets; their read pumps perform normal unregistration.
func (r *Room) Close() {
	r.mu.RLock()
	clients := make([]*Client, 0, len(r.clients))
	for _, c := range r.clients {
		clients = append(clients, c)
	}
	r.mu.RUnlock()
	for _, c := range clients {
		c.conn.Close()
	}
}
