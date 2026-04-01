import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiUrl } from "../config/env.js";
import { validateComment } from "../utils/commentFilter.js";
import { Card } from "./Card.jsx";
import { AvatarImg } from "./AvatarImg.jsx";

export function StockComments({ ticker, t }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyBody, setReplyBody] = useState("");
  const [error, setError] = useState("");
  const apiUrl = getApiUrl();
  const trans = (key) => (t ? t(key) : key);

  const loadComments = useCallback(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`${apiUrl}/api/comments/${ticker.toUpperCase()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setComments(data.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [ticker, apiUrl]);

  useEffect(() => loadComments(), [loadComments]);

  const postComment = async (text, parentId) => {
    if (!user || !text?.trim()) return;
    setError("");
    const validation = validateComment(text.trim());
    if (!validation.valid) {
      setError(validation.reason);
      return;
    }
    try {
      const res = await fetch(`${apiUrl}/api/comments/${ticker.toUpperCase()}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text.trim(), parentId: parentId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ||
            (trans("COMMENT_POST_FAILED_STATUS") + ` (${res.status})`)
        );
        return;
      }
      setBody("");
      setReplyBody("");
      setReplyingTo(null);
      loadComments();
    } catch (e) {
      console.error("Post comment failed:", e);
      setError(trans("COMMENT_POST_FAILED_NETWORK"));
    }
  };

  const toggleLike = async (commentId) => {
    if (!user) return;
    try {
      await fetch(`${apiUrl}/api/comments/${commentId}/like`, {
        method: "POST",
        credentials: "include",
      });
      loadComments();
    } catch (e) {
      console.error("Like failed:", e);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user) return;
    try {
      await fetch(`${apiUrl}/api/comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      loadComments();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  };

  return (
    <Card title={trans("COMMENTS") || "Comments"}>
      {loading ? (
        <div style={{ color: "#64748b" }}>{trans("LOADING") || "Loading…"}</div>
      ) : (
        <>
          {user ? (
            <div style={{ marginBottom: 16 }}>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setError(""); }}
                placeholder={trans("ADD_COMMENT") || "Add a comment…"}
                rows={3}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
              {error ? (
                <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>{error}</div>
              ) : null}
              <button
                type="button"
                onClick={() => postComment(body)}
                disabled={!body.trim()}
                style={{
                  marginTop: 8,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#1a3a2a",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: body.trim() ? "pointer" : "not-allowed",
                  opacity: body.trim() ? 1 : 0.6,
                }}
              >
                {trans("POST") || "Post"}
              </button>
            </div>
          ) : (
            <div style={{ color: "#64748b", marginBottom: 16, fontSize: 14 }}>
              {trans("SIGN_IN_TO_COMMENT") || "Sign in to comment"}
            </div>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {comments.length === 0 ? (
              <div style={{ color: "#64748b" }}>{trans("NO_COMMENTS") || "No comments yet."}</div>
            ) : (
              comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: 12,
                    background: "#f8fafc",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <AvatarImg src={c.author_picture} size={24} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {c.author_handle ? `@${c.author_handle}` : c.author_name || "User"}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    {user && c.user_id === user.id ? (
                      <button
                        type="button"
                        onClick={() => deleteComment(c.id)}
                        style={{
                          marginLeft: "auto",
                          fontSize: 12,
                          color: "#b91c1c",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "#334155", whiteSpace: "pre-wrap" }}>
                    {c.body}
                  </p>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => toggleLike(c.id)}
                      disabled={!user}
                      style={{
                        padding: "4px 8px",
                        border: "none",
                        background: "none",
                        cursor: user ? "pointer" : "default",
                        color: c.user_liked ? "#b91c1c" : "#64748b",
                        fontSize: 13,
                      }}
                    >
                      ♥ {c.like_count || 0}
                    </button>
                    {user ? (
                      <button
                        type="button"
                        onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                        style={{
                          padding: "4px 8px",
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "#2563eb",
                          fontSize: 13,
                        }}
                      >
                        Reply
                      </button>
                    ) : null}
                  </div>
                  {replyingTo === c.id ? (
                    <div style={{ marginTop: 8 }}>
                      <textarea
                        value={replyBody}
                        onChange={(e) => { setReplyBody(e.target.value); setError(""); }}
                        placeholder="Write a reply…"
                        rows={2}
                        style={{
                          width: "100%",
                          padding: 8,
                          borderRadius: 6,
                          border: "1px solid #e5e7eb",
                          fontSize: 13,
                        }}
                      />
                      <div style={{ marginTop: 4, display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => postComment(replyBody, c.id)}
                          disabled={!replyBody.trim()}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "#2563eb",
                            color: "#fff",
                            fontSize: 13,
                            cursor: replyBody.trim() ? "pointer" : "not-allowed",
                          }}
                        >
                          Reply
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyBody("");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {c.replies?.length > 0 ? (
                    <div style={{ marginTop: 12, marginLeft: 16, borderLeft: "2px solid #e5e7eb", paddingLeft: 12 }}>
                      {c.replies.map((r) => (
                        <div key={r.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>
                              {r.author_handle ? `@${r.author_handle}` : r.author_name}
                            </span>
                            <span style={{ fontSize: 11, color: "#64748b" }}>
                              {new Date(r.created_at).toLocaleDateString()}
                            </span>
                            {user && r.user_id === user.id ? (
                              <button
                                type="button"
                                onClick={() => deleteComment(r.id)}
                                style={{
                                  marginLeft: "auto",
                                  fontSize: 11,
                                  color: "#b91c1c",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>{r.body}</p>
                          <button
                            type="button"
                            onClick={() => toggleLike(r.id)}
                            disabled={!user}
                            style={{
                              padding: "2px 6px",
                              border: "none",
                              background: "none",
                              cursor: user ? "pointer" : "default",
                              color: r.user_liked ? "#b91c1c" : "#64748b",
                              fontSize: 12,
                            }}
                          >
                            ♥ {r.like_count || 0}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </Card>
  );
}
