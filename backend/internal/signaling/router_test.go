package signaling

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func connect(t *testing.T, url, room, peer string) *websocket.Conn {
	t.Helper()
	c, _, err := websocket.DefaultDialer.Dial(url+"?room="+room+"&peer="+peer+"&auth="+strings.Repeat("a", 64), nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { c.Close() })
	return c
}
func read(t *testing.T, c *websocket.Conn) map[string]any {
	t.Helper()
	c.SetReadDeadline(time.Now().Add(2 * time.Second))
	var m map[string]any
	if err := c.ReadJSON(&m); err != nil {
		t.Fatal(err)
	}
	return m
}
func TestRoomRoutingAndIdentity(t *testing.T) {
	router := NewRouter()
	server := httptest.NewServer(router)
	defer server.Close()
	url := "ws" + strings.TrimPrefix(server.URL, "http")
	a := connect(t, url, "room-one", "peer-one")
	if read(t, a)["type"] != "welcome" {
		t.Fatal("missing welcome")
	}
	b := connect(t, url, "room-one", "peer-two")
	welcome := read(t, b)
	if len(welcome["peers"].([]any)) != 1 {
		t.Fatal("incorrect roster")
	}
	if read(t, a)["type"] != "peer-joined" {
		t.Fatal("missing join")
	}
	other := connect(t, url, "room-two", "peer-two")
	read(t, other)
	a.WriteJSON(map[string]any{"type": "offer", "to": "peer-two", "from": "forged", "description": map[string]string{"type": "offer", "sdp": "test"}})
	msg := read(t, b)
	if msg["from"] != "peer-one" || msg["type"] != "offer" {
		t.Fatal("sender identity not enforced")
	}
	other.SetReadDeadline(time.Now().Add(80 * time.Millisecond))
	if _, _, err := other.ReadMessage(); err == nil {
		t.Fatal("cross-room signal leaked")
	}
	b.Close()
	if read(t, a)["type"] != "peer-left" {
		t.Fatal("missing leave")
	}
}
func TestAuthenticationAndValidation(t *testing.T) {
	server := httptest.NewServer(NewRouter())
	defer server.Close()
	url := "ws" + strings.TrimPrefix(server.URL, "http")
	_, response, err := websocket.DefaultDialer.Dial(url+"?room=room-one&peer=peer-one", nil)
	if err == nil || response.StatusCode != 401 {
		t.Fatal("missing capability accepted")
	}
	a := connect(t, url, "room-one", "peer-one")
	read(t, a)
	bad, _, err := websocket.DefaultDialer.Dial(url+"?room=room-one&peer=peer-two&auth="+strings.Repeat("b", 64), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer bad.Close()
	bad.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = bad.ReadMessage()
	if !websocket.IsCloseError(err, 1008) {
		t.Fatalf("wrong key accepted: %v", err)
	}
	duplicate := connect(t, url, "room-one", "peer-one")
	duplicate.SetReadDeadline(time.Now().Add(time.Second))
	_, _, err = duplicate.ReadMessage()
	if !websocket.IsCloseError(err, 1008) {
		t.Fatal("duplicate accepted")
	}
	_, response, err = websocket.DefaultDialer.Dial(url+"?room=x&peer=peer-one&auth="+strings.Repeat("a", 64), nil)
	if err == nil || response.StatusCode != 400 {
		t.Fatal("invalid ID accepted")
	}
}
func TestEmptyRoomCleanup(t *testing.T) {
	router := NewRouter()
	server := httptest.NewServer(router)
	defer server.Close()
	c := connect(t, "ws"+strings.TrimPrefix(server.URL, "http"), "room-one", "peer-one")
	read(t, c)
	c.Close()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		router.mu.Lock()
		size := len(router.rooms)
		router.mu.Unlock()
		if size == 0 {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("room retained")
}
func TestUnknownPayloadNotRelayed(t *testing.T) {
	server := httptest.NewServer(NewRouter())
	defer server.Close()
	url := "ws" + strings.TrimPrefix(server.URL, "http")
	a := connect(t, url, "room-one", "peer-one")
	read(t, a)
	b := connect(t, url, "room-one", "peer-two")
	read(t, b)
	read(t, a)
	a.WriteMessage(websocket.TextMessage, []byte("invalid JSON"))
	a.WriteJSON(map[string]any{"type": "chat", "to": "peer-two", "text": "private"})
	a.WriteJSON(map[string]any{"type": "answer", "to": "peer-two", "description": json.RawMessage(`{"type":"answer"}`)})
	if read(t, b)["type"] != "answer" {
		t.Fatal("application data relayed")
	}
}
