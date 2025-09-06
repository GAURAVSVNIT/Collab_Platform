import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import './meet.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export default function Meet() {
  const [meetingId, setMeetingId] = useState("");
  const [username, setUsername] = useState("User");
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState([]);
  const [joined, setJoined] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const mySocketIdRef = useRef(null);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, { autoConnect: false });

    socketRef.current.on("connect", () => {
      mySocketIdRef.current = socketRef.current.id;
      console.log("Connected as", mySocketIdRef.current);
    });

    // someone joined
    socketRef.current.on("joined", async (id) => {
      console.log("New peer joined:", id);
      pcRef.current = createPeerConnection(id);
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);
      socketRef.current.emit("offer_message", {
        to: id,
        from: mySocketIdRef.current,
        sdp: offer,
      });
    });

    // received offer
    socketRef.current.on("offer_message", async ({ from, sdp }) => {
      pcRef.current = createPeerConnection(from);
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(answer);
      socketRef.current.emit("answer_message", {
        to: from,
        from: mySocketIdRef.current,
        sdp: answer,
      });
    });

    // received answer
    socketRef.current.on("answer_message", async ({ sdp }) => {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    // ICE candidate
    socketRef.current.on("ice_candidate", async ({ candidate }) => {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding ICE candidate", err);
      }
    });

    // chat message
    socketRef.current.on("sendmessage", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  async function startLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    } catch (err) {
      alert("Could not access camera/mic: " + err.message);
    }
  }

  function createPeerConnection(remoteId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // send ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("ice_candidate", {
          to: remoteId,
          from: mySocketIdRef.current,
          candidate: event.candidate,
        });
      }
    };

    // remote stream
    pc.ontrack = (evt) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = evt.streams[0];
      }
    };

    // add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  }

  async function joinMeeting() {
    if (!meetingId) {
      alert("Enter a meeting ID");
      return;
    }
    await startLocalMedia();
    socketRef.current.connect();
    socketRef.current.emit(
      "joined",
      JSON.stringify({ meetingid: meetingId, username })
    );
    setJoined(true);
  }

  function leaveMeeting() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    socketRef.current.disconnect();
    setJoined(false);
  }

  function sendChat() {
    if (!chatText.trim()) return;
    const msg = { from: username, text: chatText };
    socketRef.current.emit("sendmessage", msg);
    setMessages((prev) => [...prev, msg]);
    setChatText("");
  }

  return (
    <div className="app">
      <h1>Simple Meet (React + WebRTC)</h1>

      <div className="controls">
        <input
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
          placeholder="Meeting ID"
        />
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Your name"
        />
        <button onClick={joinMeeting} disabled={joined}>
          Join
        </button>
        <button onClick={leaveMeeting} disabled={!joined}>
          Leave
        </button>
      </div>

      <div className="videos">
        <div>
          <h3>Local</h3>
          <video ref={localVideoRef} autoPlay playsInline muted />
        </div>
        <div>
          <h3>Remote</h3>
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
      </div>

      <div className="chat">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i}>
              <strong>{m.from}: </strong>
              {m.text}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendChat()}
            placeholder="Type a message"
          />
          <button onClick={sendChat}>Send</button>
        </div>
      </div>
    </div>
  );
}
