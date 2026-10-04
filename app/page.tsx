"use client";

import { useEffect, useState } from "react";
import {
  Bell, Compass, Heart, Home, Image, MessageCircle, Plus, Search,
  Send, Settings, UserRound, Users, Video, LogOut
} from "lucide-react";
import { supabase } from "../lib/supabase";

type FeedPost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  likes: { user_id: string }[];
};

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedPost[]>([]);
  const [postText, setPostText] = useState("");
  const [profileName, setProfileName] = useState("");
  const [username, setUsername] = useState("");
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(() => {
    const client = supabase();

    const load = async () => {
      const { data } = await client.auth.getUser();
      if (data.user) {
        setUserId(data.user.id);
        setEmail(data.user.email ?? "");
        const { data: profile } = await client.from("profiles").select("display_name,username").eq("id", data.user.id).maybeSingle();
        setProfileName(profile?.display_name ?? "");
        setUsername(profile?.username ?? "");
        setShowProfileSetup(!profile?.display_name || !profile?.username);
        await loadFeed();
      }
    };

    load();

    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        setEmail(session.user.email ?? "");
        const { data: profile } = await client.from("profiles").select("display_name,username").eq("id", session.user.id).maybeSingle();
        setProfileName(profile?.display_name ?? "");
        setUsername(profile?.username ?? "");
        setShowProfileSetup(!profile?.display_name || !profile?.username);
        await loadFeed();
      } else {
        setFeed([]);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadFeed() {
    if (!userId) {
      const { data: auth } = await supabase().auth.getUser();
      if (!auth.user) return;
    }
    const { data, error } = await supabase()
      .from("posts")
      .select("id,content,created_at,author_id,profiles:author_id(display_name,username,avatar_url),likes(user_id)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) setFeed(data as unknown as FeedPost[]);
  }

  async function otp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase().auth.verifyOtp({
      email,
      token: code,
      type: "email"
    });
    setLoading(false);
    if (error) setErrorMsg(error.message);
    else {
      setSent(false);
      setCode("");
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    setUserId(null);
    setSent(false);
    setCode("");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !profileName.trim() || !username.trim()) return;
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
    const { error } = await supabase().from("profiles").update({ display_name: profileName.trim(), username: cleanUsername }).eq("id", userId);
    if (error) { setErrorMsg(error.message); return; }
    setUsername(cleanUsername); setShowProfileSetup(false); setErrorMsg("");
  }

  async function createPost(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !postText.trim()) return;

    const text = postText.trim();
    setPostText("");

    const { error } = await supabase().from("posts").insert({
      author_id: userId,
      content: text,
      visibility: "public"
    });

    if (error) {
      setErrorMsg(error.message);
      setPostText(text);
      return;
    }

    await loadFeed();
  }

  async function toggleLike(post: FeedPost) {
    if (!userId) return;
    const liked = post.likes.some((like) => like.user_id === userId);

    if (liked) {
      await supabase().from("likes").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      await supabase().from("likes").insert({ post_id: post.id, user_id: userId });
    }

    await loadFeed();
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1450px]">
        <aside className="hidden w-[250px] flex-col border-r border-white/5 p-5 lg:flex">
          <div className="mb-10 flex items-center gap-2 text-xl font-bold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)]">Z</span>
            zenchat
          </div>
          <nav className="space-y-2">
            {[[Home, "Home"], [Compass, "Discover"], [MessageCircle, "Messages"], [Bell, "Notifications"], [Users, "Communities"], [UserRound, "Profile"]].map(([I, n]: any) => (
              <button key={n} className="soft flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-zinc-300 hover:text-white">
                <I size={18} />{n}
              </button>
            ))}
          </nav>
          <div className="mt-auto">
            {userId ? (
              <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-500 hover:text-white">
                <LogOut size={18} />Sign out
              </button>
            ) : (
              <button className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-500">
                <Settings size={18} />Settings
              </button>
            )}
          </div>
        </aside>

        <section className="w-full max-w-[760px] border-r border-white/5">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#07090d]/85 px-5 py-4 backdrop-blur-xl">
            <div>
              <div className="text-xs text-zinc-500">YOUR SPACE</div>
              <h1 className="text-lg font-semibold">Home</h1>
            </div>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><Search size={18} /></button>
          </header>

          <div className="flex gap-3 overflow-x-auto border-b border-white/5 p-4 scrollbar">
            {["Your story", "+ Add story", "Maya", "Daniel", "Aisha"].map((x, i) => (
              <div key={x} className="min-w-[76px] text-center text-xs text-zinc-400">
                <div className={`mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border ${i === 1 ? "border-dashed border-zinc-600" : "border-[var(--accent)] bg-gradient-to-br from-violet-500/30 to-cyan-400/20"}`}>
                  {i === 1 ? <Plus size={18} /> : i === 0 ? <UserRound size={20} /> : x[0]}
                </div>
                {x}
              </div>
            ))}
          </div>

          <div className="p-4">
            {showProfileSetup && userId && (
              <form onSubmit={saveProfile} className="glass soft mb-4 rounded-2xl p-5">
                <div className="text-xs font-semibold uppercase tracking-[.16em] text-violet-300">Welcome to Zenchat</div>
                <h2 className="mt-2 text-xl font-semibold">Set up your profile</h2>
                <p className="mt-1 text-xs text-zinc-500">Choose the name and username people will see.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <input required value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Display name" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-violet-400"/>
                  <input required value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0,30))} placeholder="username" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-violet-400"/>
                </div>
                <button className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black">Continue</button>
              </form>
            )}
            <form onSubmit={createPost} className="glass soft rounded-2xl p-4">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-bold">Z</div>
                <div className="flex-1">
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    disabled={!userId}
                    placeholder={userId ? "Share something meaningful..." : "Sign in to start posting..."}
                    className="min-h-16 w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-600 disabled:cursor-not-allowed"
                  />
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex gap-1">
                      <button type="button" disabled={!userId} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5"><Image size={18} /></button>
                      <button type="button" disabled={!userId} className="rounded-lg p-2 text-zinc-500 hover:bg-white/5"><Video size={18} /></button>
                    </div>
                    <button disabled={!userId || !postText.trim()} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Post</button>
                  </div>
                </div>
              </div>
            </form>

            {feed.map((post) => {
              const liked = !!userId && post.likes.some((like) => like.user_id === userId);
              const name = post.profiles?.display_name || post.profiles?.username || "Zenchat user";
              return (
                <article key={post.id} className="glass soft mt-4 rounded-2xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-orange-400/20">{name[0]}</div>
                    <div>
                      <b className="text-sm">{name}</b>
                      <div className="text-xs text-zinc-600">@{post.profiles?.username || "member"} · {new Date(post.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{post.content}</p>
                  <div className="mt-4 flex justify-between border-t border-white/5 pt-4 text-xs text-zinc-500">
                    <button onClick={() => toggleLike(post)} className={`flex gap-2 hover:text-white ${liked ? "text-pink-400" : ""}`}>
                      <Heart size={17} fill={liked ? "currentColor" : "none"} />{post.likes.length}
                    </button>
                    <button className="flex gap-2 hover:text-white"><MessageCircle size={17} />Comment</button>
                    <button className="hover:text-white">↗ Share</button>
                  </div>
                </article>
              );
            })}

            {errorMsg && <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">{errorMsg}</div>}

            {userId && feed.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-600">Your feed is quiet. Be the first to post.</div>
            )}
          </div>
        </section>

        <aside className="hidden w-[330px] p-5 xl:block">
          <div className="glass rounded-2xl p-4">
            <div className="mb-4 flex items-center justify-between"><b className="text-sm">People to follow</b><span className="text-xs text-[var(--accent)]">See all</span></div>
            {["Aisha Cole", "Daniel King", "Maya Carter"].map((x) => (
              <div className="mb-4 flex items-center gap-3" key={x}>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs">{x[0]}</div>
                <div className="flex-1"><b className="text-xs">{x}</b><p className="text-[11px] text-zinc-600">@{x.toLowerCase().replace(" ", "")}</p></div>
                <button className="rounded-full border border-white/10 px-3 py-1 text-[10px]">Follow</button>
              </div>
            ))}
          </div>

          {!userId && (
            <div className="mt-4 glass rounded-2xl p-4">
              <b className="text-sm">Sign in to Zenchat</b>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Use your email. We’ll send a one-time verification code.</p>
              <form onSubmit={sent ? verify : otp} className="mt-4 space-y-2">
                <input required type="email" value={email} disabled={sent} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none focus:border-violet-400 disabled:opacity-50" />
                {sent && <input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-sm tracking-[0.4em] outline-none focus:border-violet-400" />}
                <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-semibold text-black disabled:opacity-50">
                  {loading ? (sent ? "Verifying…" : "Sending…") : sent ? "Verify OTP" : "Send OTP"}<Send size={14} />
                </button>
              </form>
              {sent && <p className="mt-3 text-[11px] text-emerald-400">Enter the six-digit code from your email.</p>}
              {errorMsg && <p className="mt-3 text-[11px] text-red-400">{errorMsg}</p>}
            </div>
          )}

          {userId && (
            <div className="mt-4 glass rounded-2xl p-4">
              <div className="text-xs text-zinc-500">SIGNED IN</div>
              <div className="mt-1 truncate text-sm">{email}</div>
              <button onClick={signOut} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-xs hover:bg-white/5"><LogOut size={14} /> Sign out</button>
            </div>
          )}

          {errorMsg && userId && <p className="mt-3 text-[11px] text-red-400">{errorMsg}</p>}
        </aside>
      </div>

      <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-[#10141c]/90 p-1 shadow-2xl backdrop-blur-xl lg:hidden">
        {[[Home, "Home"], [Compass, "Discover"], [Plus, "Create"], [MessageCircle, "Chat"], [UserRound, "Me"]].map(([I, n]: any) => (
          <button key={n} className="grid h-12 w-14 place-items-center text-zinc-400"><I size={19} /></button>
        ))}
      </div>
    </main>
  );
}
