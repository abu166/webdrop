package hub

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"time"
)

type Client struct {
	hub    *Room
	conn   *websocket.Conn
	send   chan []byte
	id     string
	roomID string
}

func NewClient(room *Room, conn *websocket.Conn, id, roomID string) *Client {
	return &Client{hub: room, conn: conn, send: make(chan []byte, 128), id: id, roomID: roomID}
}
func (c *Client) ReadPump() {
	defer func() { c.hub.Unregister(c); c.conn.Close() }()
	c.conn.SetReadLimit(64 * 1024)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error { return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second)) })
	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		var msg map[string]json.RawMessage
		if json.Unmarshal(data, &msg) != nil {
			continue
		}
		var kind, to string
		json.Unmarshal(msg["type"], &kind)
		json.Unmarshal(msg["to"], &to)
		if to == "" || (kind != "offer" && kind != "answer" && kind != "ice-candidate") {
			continue
		}
		msg["from"], _ = json.Marshal(c.id)
		clean, err := json.Marshal(msg)
		if err == nil {
			c.hub.Broadcast(clean, c)
		}
	}
}
func (c *Client) WritePump() {
	ticker := time.NewTicker(25 * time.Second)
	defer func() { ticker.Stop(); c.conn.Close() }()
	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if c.conn.WriteMessage(websocket.TextMessage, msg) != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if c.conn.WriteMessage(websocket.PingMessage, nil) != nil {
				return
			}
		}
	}
}
