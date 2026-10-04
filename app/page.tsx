"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Compass, Heart, Home, Image, MessageCircle, Plus, Search, Send, Settings, UserRound, Users, Video, LogOut, Paperclip, Smile, Check, CheckCheck, ArrowLeft, MoreHorizontal, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type Profile = { display_name:string|null; username:string|null; avatar_url?:string|null };
type Comment = { id:string; content:string; user_id:string; created_at:string; profiles:Profile|null };
type FeedPost = { id:string; content:string; created_at:string; author_id:string; profiles:Profile|null; likes:{user_id:string}[]; comments:Comment[] };
type Conversation = { id:string; kind:string; title:string|null; avatar_url:string|null; other:Profile|null; otherId:string|null; lastMessage:string; lastAt:string|null; unread:boolean };
type ChatMessage = { id:string; conversation_id:string; sender_id:string; content:string; attachment_path:string|null; attachment_type:string|null; created_at:string; edited_at:string|null; deleted_at:string|null; reactions:{message_id:string;user_id:string;reaction:string}[]; sender:Profile|null };
type Notification = { id:string; recipient_id:string; actor_id:string|null; type:string; post_id:string|null; comment_id:string|null; conversation_id:string|null; message_id:string|null; read_at:string|null; created_at:string; actor:Profile|null };\ntype Story = { id:string; author_id:string; media_path:string|null; media_type:string|null; text_content:string|null; expires_at:string; created_at:string; author:Profile|null; viewed:boolean };\ntype Community = { id:string; name:string; slug:string; description:string; cover_url:string|null; created_by:string; created_at:string; memberCount:number; joined:boolean };

export default function HomePage() {
  const [email,setEmail]=useState(""); const [code,setCode]=useState(""); const [sent,setSent]=useState(false);
  const [loading,setLoading]=useState(false); const [errorMsg,setErrorMsg]=useState(""); const [userId,setUserId]=useState<string|null>(null);
  const [feed,setFeed]=useState<FeedPost[]>([]); const [postText,setPostText]=useState(""); const [profileName,setProfileName]=useState(""); const [username,setUsername]=useState("");
  const [showProfileSetup,setShowProfileSetup]=useState(false); const [commentDrafts,setCommentDrafts]=useState<Record<string,string>>({});
  const [expandedComments,setExpandedComments]=useState<Record<string,boolean>>({}); const [following,setFollowing]=useState<string[]>([]);
  const [view,setView]=useState<"home"|"discover"|"profile"|"messages"|"notifications"|"communities">("home");\n  const [stories,setStories]=useState<Story[]>([]); const [communities,setCommunities]=useState<Community[]>([]); const [discoverQuery,setDiscoverQuery]=useState(""); const [communityQuery,setCommunityQuery]=useState(""); const [storyComposer,setStoryComposer]=useState(false); const [storyText,setStoryText]=useState(""); const [selectedStory,setSelectedStory]=useState<Story|null>(null);
  const [conversations,setConversations]=useState<Conversation[]>([]); const [activeConversation,setActiveConversation]=useState<string|null>(null);
  const [messages,setMessages]=useState<ChatMessage[]>([]); const [messageText,setMessageText]=useState(""); const [chatLoading,setChatLoading]=useState(false);
  const [typing,setTyping]=useState(false); const [remoteTyping,setRemoteTyping]=useState(false); const [presence,setPresence]=useState<Record<string,boolean>>({}); const [mobileChat,setMobileChat]=useState(false);\n  const [notifications,setNotifications]=useState<Notification[]>([]); const [notificationUnread,setNotificationUnread]=useState(0);

  useEffect(()=>{ const client=supabase(); let mounted=true;
    const load=async()=>{ const {data}=await client.auth.getUser(); if(!mounted)return; if(data.user){ await hydrateUser(data.user.id,data.user.email??""); } };
    load();
    const {data:listener}=client.auth.onAuthStateChange(async(_event,session)=>{ if(session?.user) await hydrateUser(session.user.id,session.user.email??""); else {setUserId(null);setFeed([]);setConversations([]);setMessages([]);} });
    return()=>{mounted=false;listener.subscription.unsubscribe();};
  },[]);

  async function hydrateUser(id:string,mail:string){ setUserId(id);setEmail(mail);
    const c=supabase(); const {data:profile}=await c.from("profiles").select("display_name,username,avatar_url").eq("id",id).maybeSingle();
    setProfileName(profile?.display_name??"");setUsername(profile?.username??"");setShowProfileSetup(!profile?.display_name||!profile?.username); await loadFeed(id); await loadConversations(id); await loadNotifications(id); await loadStories(id); await loadCommunities(id);
  }
  async function loadFeed(id?:string){ const uid=id??userId??(await supabase().auth.getUser()).data.user?.id; if(!uid)return;
    const {data}=await supabase().from("posts").select("id,content,created_at,author_id,profiles:author_id(display_name,username,avatar_url),likes(user_id),comments(id,content,user_id,created_at,profiles:user_id(display_name,username))").order("created_at",{ascending:false}).limit(30);
    if(data)setFeed(data as unknown as FeedPost[]); const {data:f}=await supabase().from("follows").select("following_id").eq("follower_id",uid);setFollowing((f??[]).map((x:any)=>x.following_id));
  }
  async function loadConversations(uid?:string){ const id=uid??userId;if(!id)return; const c=supabase();
    const {data:members}=await c.from("conversation_members").select("conversation_id,user_id").eq("user_id",id);
    if(!members?.length){setConversations([]);return;}
    const ids=members.map(m=>m.conversation_id); const {data:cs}=await c.from("conversations").select("id,kind,title,avatar_url,updated_at").in("id",ids).order("updated_at",{ascending:false});
    const rows:Conversation[]=[]; for(const x of cs??[]){ const {data:ms}=await c.from("conversation_members").select("user_id").eq("conversation_id",x.id); const otherId=ms?.find(m=>m.user_id!==id)?.user_id??null;
      let other:Profile|null=null;if(otherId){const {data:p}=await c.from("profiles").select("display_name,username,avatar_url").eq("id",otherId).maybeSingle();other=p;}
      const {data:last}=await c.from("messages").select("content,created_at").eq("conversation_id",x.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
      rows.push({id:x.id,kind:x.kind,title:x.title,avatar_url:x.avatar_url,other,otherId,lastMessage:last?.content??"Start the conversation",lastAt:last?.created_at??x.updated_at,unread:false});
    } setConversations(rows);
  }
  async function loadStories(uid?:string){
    const id=uid??userId;if(!id)return;
    const {data,error}=await supabase().from("stories").select("id,author_id,media_path,media_type,text_content,expires_at,created_at,author:author_id(display_name,username,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(50);
    if(error){setErrorMsg(error.message);return;}
    const rows=(data??[]) as unknown as Story[];
    const ids=rows.map(x=>x.id); let viewed:string[]=[];
    if(ids.length){const {data:v}=await supabase().from("story_views").select("story_id").eq("viewer_id",id).in("story_id",ids);viewed=(v??[]).map((x:any)=>x.story_id);}
    setStories(rows.map(x=>({...x,viewed:viewed.includes(x.id)})));
  }
  async function createStory(e?:React.FormEvent){
    e?.preventDefault(); if(!userId||!storyText.trim())return;
    const {error}=await supabase().from("stories").insert({author_id:userId,media_type:"text",text_content:storyText.trim()});
    if(error){setErrorMsg(error.message);return;} setStoryText("");setStoryComposer(false);await loadStories(userId);
  }
  async function viewStory(story:Story){
    setSelectedStory(story); if(userId&&!story.viewed){await supabase().from("story_views").upsert({story_id:story.id,viewer_id:userId},{onConflict:"story_id,viewer_id"});setStories(prev=>prev.map(x=>x.id===story.id?{...x,viewed:true}:x));}
  }
  async function loadCommunities(uid?:string){
    const id=uid??userId;if(!id)return;
    const {data,error}=await supabase().from("communities").select("id,name,slug,description,cover_url,created_by,created_at,community_members(user_id)").order("created_at",{ascending:false}).limit(50);
    if(error){setErrorMsg(error.message);return;}
    setCommunities((data??[]).map((x:any)=>({...x,memberCount:(x.community_members??[]).length,joined:(x.community_members??[]).some((m:any)=>m.user_id===id)})));
  }
  async function toggleCommunity(c:Community){
    if(!userId)return;
    if(c.joined) await supabase().from("community_members").delete().eq("community_id",c.id).eq("user_id",userId);
    else await supabase().from("community_members").insert({community_id:c.id,user_id:userId});
    await loadCommunities(userId);
  }

  async function loadNotifications(uid?:string){
    const id=uid??userId;if(!id)return;
    const {data,error}=await supabase().from("notifications").select("id,recipient_id,actor_id,type,post_id,comment_id,conversation_id,message_id,read_at,created_at,actor:actor_id(display_name,username,avatar_url)").eq("recipient_id",id).order("created_at",{ascending:false}).limit(50);
    if(error){setErrorMsg(error.message);return;}
    setNotifications((data??[]) as unknown as Notification[]);
    setNotificationUnread((data??[]).filter((n:any)=>!n.read_at).length);
  }
  async function markNotificationRead(id:string){
    if(!userId)return;
    await supabase().from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("recipient_id",userId);
    setNotifications(prev=>prev.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));
    setNotificationUnread(n=>Math.max(0,n-1));
  }
  async function markAllNotificationsRead(){
    if(!userId||notificationUnread===0)return;
    const now=new Date().toISOString();
    await supabase().from("notifications").update({read_at:now}).eq("recipient_id",userId).is("read_at",null);
    setNotifications(prev=>prev.map(n=>({...n,read_at:n.read_at??now})));
    setNotificationUnread(0);
  }

  async function openConversation(id:string){ setActiveConversation(id);setMobileChat(true);await loadMessages(id);await markRead(id); }
  async function loadMessages(id:string){ const c=supabase(); const {data,error}=await c.from("messages").select("id,conversation_id,sender_id,content,attachment_path,attachment_type,created_at,edited_at,deleted_at,reactions:message_reactions(message_id,user_id,reaction),sender:sender_id(display_name,username,avatar_url)").eq("conversation_id",id).order("created_at",{ascending:true}).limit(200);if(error){setErrorMsg(error.message);return;}setMessages((data??[]) as unknown as ChatMessage[]); }
  async function markRead(id:string){if(!userId)return;await supabase().from("conversation_members").update({last_read_at:new Date().toISOString()}).eq("conversation_id",id).eq("user_id",userId);}
  async function startConversation(targetId:string){if(!userId||targetId===userId)return;const c=supabase();const {data:existing}=await c.from("conversation_members").select("conversation_id").eq("user_id",userId);
    for(const m of existing??[]){const {data:has}=await c.from("conversation_members").select("user_id").eq("conversation_id",m.conversation_id).eq("user_id",targetId).maybeSingle();if(has){await openConversation(m.conversation_id);return;}}
    const {data:conv,error}=await c.from("conversations").insert({kind:"direct",created_by:userId}).select("id").single();if(error||!conv){setErrorMsg(error?.message??"Could not create conversation");return;}
    const {error:e1}=await c.from("conversation_members").insert([{conversation_id:conv.id,user_id:userId,role:"admin"},{conversation_id:conv.id,user_id:targetId,role:"member"}]);if(e1){setErrorMsg(e1.message);return;}await loadConversations(userId);await openConversation(conv.id);
  }
  useEffect(()=>{if(!userId)return;const c=supabase();
    const channel=c.channel("notifications:"+userId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq."+userId},async(payload)=>{
        const n=payload.new as any;
        const {data:full}=await c.from("notifications").select("id,recipient_id,actor_id,type,post_id,comment_id,conversation_id,message_id,read_at,created_at,actor:actor_id(display_name,username,avatar_url)").eq("id",n.id).maybeSingle();
        if(full){setNotifications(prev=>prev.some(x=>x.id===n.id)?prev:[full as unknown as Notification,...prev]);setNotificationUnread(x=>x+1);}
      })
      .subscribe();
    return()=>{c.removeChannel(channel);};
  },[userId]);

  useEffect(()=>{if(!activeConversation||!userId)return;const c=supabase();
    const channel=c.channel("chat:"+activeConversation)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+activeConversation},async(payload)=>{const m=payload.new as any;const {data:full}=await c.from("messages").select("id,conversation_id,sender_id,content,attachment_path,attachment_type,created_at,edited_at,deleted_at,reactions:message_reactions(message_id,user_id,reaction),sender:sender_id(display_name,username,avatar_url)").eq("id",m.id).single();if(full)setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,full as unknown as ChatMessage]);await markRead(activeConversation);})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"message_reactions"},()=>activeConversation&&loadMessages(activeConversation))
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"message_reactions"},()=>activeConversation&&loadMessages(activeConversation))
      .subscribe();
    return()=>{c.removeChannel(channel);};
  },[activeConversation,userId]);

  useEffect(()=>{if(!userId)return;const c=supabase();const ch=c.channel("presence:"+userId,{config:{presence:{key:userId}}});
    ch.on("presence",{event:"sync"},()=>{const state=ch.presenceState();const online:Record<string,boolean>={};Object.keys(state).forEach(k=>online[k]=true);setPresence(online);})
      .on("presence",{event:"join"},({key})=>setPresence(p=>({...p,[key]:true}))).on("presence",{event:"leave"},({key})=>setPresence(p=>{const n={...p};delete n[key];return n;}))
      .subscribe(async status=>{if(status==="SUBSCRIBED"){await ch.track({online_at:new Date().toISOString()});}});
    return()=>{c.removeChannel(ch);};
  },[userId]);

  useEffect(()=>{if(!activeConversation||!userId)return;const c=supabase();const ch=c.channel("typing:"+activeConversation);
    ch.on("broadcast",{event:"typing"},({payload})=>{if(payload.userId!==userId){setRemoteTyping(!!payload.typing);if(payload.typing)setTimeout(()=>setRemoteTyping(false),1800);}}).subscribe();return()=>{c.removeChannel(ch);};
  },[activeConversation,userId]);

  async function broadcastTyping(value:boolean){if(!activeConversation||!userId)return;const c=supabase();const ch=c.channel("typing:"+activeConversation);await ch.subscribe();await ch.send({type:"broadcast",event:"typing",payload:{userId,typing:value}});c.removeChannel(ch);}
  async function sendMessage(e?:React.FormEvent){e?.preventDefault();if(!userId||!activeConversation||!messageText.trim())return;const text=messageText.trim();setMessageText("");setTyping(false);setChatLoading(true);
    const {error}=await supabase().from("messages").insert({conversation_id:activeConversation,sender_id:userId,content:text});setChatLoading(false);if(error){setMessageText(text);setErrorMsg(error.message);return;}await loadMessages(activeConversation);await loadConversations(userId);
  }
  async function toggleReaction(m:ChatMessage){if(!userId)return;const mine=m.reactions.find(r=>r.user_id===userId);if(mine){await supabase().from("message_reactions").delete().eq("message_id",m.id).eq("user_id",userId);}else await supabase().from("message_reactions").insert({message_id:m.id,user_id:userId,reaction:"heart"});if(activeConversation)await loadMessages(activeConversation);}
  async function otp(e:React.FormEvent){e.preventDefault();setLoading(true);setErrorMsg("");const {error}=await supabase().auth.signInWithOtp({email,options:{shouldCreateUser:true}});setLoading(false);if(error)setErrorMsg(error.message);else setSent(true);}
  async function verify(e:React.FormEvent){e.preventDefault();setLoading(true);setErrorMsg("");const {error}=await supabase().auth.verifyOtp({email,token:code,type:"email"});setLoading(false);if(error)setErrorMsg(error.message);else{setSent(false);setCode("");}}
  async function signOut(){await supabase().auth.signOut();setUserId(null);setView("home");setActiveConversation(null);}
  async function saveProfile(e:React.FormEvent){e.preventDefault();if(!userId||!profileName.trim()||!username.trim())return;const clean=username.trim().toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,30);const {error}=await supabase().from("profiles").update({display_name:profileName.trim(),username:clean}).eq("id",userId);if(error){setErrorMsg(error.message);return;}setUsername(clean);setShowProfileSetup(false);}
  async function createPost(e:React.FormEvent){e.preventDefault();if(!userId||!postText.trim())return;const text=postText.trim();setPostText("");const {error}=await supabase().from("posts").insert({author_id:userId,content:text,visibility:"public"});if(error){setErrorMsg(error.message);setPostText(text);return;}await loadFeed(userId);}
  async function addComment(postId:string){if(!userId)return;const content=(commentDrafts[postId]||"").trim();if(!content)return;const {error}=await supabase().from("comments").insert({post_id:postId,user_id:userId,content});if(error){setErrorMsg(error.message);return;}setCommentDrafts(d=>({...d,[postId]:""}));await loadFeed(userId);}
  async function toggleFollow(targetId:string){if(!userId||userId===targetId)return;if(following.includes(targetId)){await supabase().from("follows").delete().eq("follower_id",userId).eq("following_id",targetId);setFollowing(x=>x.filter(id=>id!==targetId));}else{const {error}=await supabase().from("follows").insert({follower_id:userId,following_id:targetId});if(error){setErrorMsg(error.message);return;}setFollowing(x=>[...x,targetId]);}}
  async function toggleLike(post:FeedPost){if(!userId)return;const liked=post.likes.some(l=>l.user_id===userId);if(liked)await supabase().from("likes").delete().eq("post_id",post.id).eq("user_id",userId);else await supabase().from("likes").insert({post_id:post.id,user_id:userId});await loadFeed(userId);}

  const active=conversations.find(c=>c.id===activeConversation); const filteredCommunities=communities.filter(c=>(c.name+" "+c.description).toLowerCase().includes(communityQuery.toLowerCase())); const filteredDiscover=feed.filter(p=>{const q=discoverQuery.toLowerCase();return !q||p.content.toLowerCase().includes(q)||(p.profiles?.display_name||"").toLowerCase().includes(q)||(p.profiles?.username||"").toLowerCase().includes(q);}); const people=useMemo(()=>feed.filter(p=>p.author_id!==userId).map(p=>({id:p.author_id,name:p.profiles?.display_name||"Zenchat user",username:p.profiles?.username||"member"})).filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).slice(0,4),[feed,userId]);

  return <main className="min-h-screen"><div className="mx-auto flex min-h-screen max-w-[1450px]">
    <aside className="hidden w-[250px] flex-col border-r border-white/5 p-5 lg:flex"><div className="mb-10 flex items-center gap-2 text-xl font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)]">Z</span>zenchat</div>
      <nav className="space-y-2">{[[Home,"Home"],[Compass,"Discover"],[MessageCircle,"Messages"],[Bell,"Notifications"],[Users,"Communities"],[UserRound,"Profile"]].map(([I,n]:any)=><button key={n} onClick={()=>{if(n==="Profile")setView("profile");if(n==="Home")setView("home");if(n==="Discover")setView("discover");if(n==="Communities"){setView("communities");loadCommunities();}if(n==="Messages"){setView("messages");setMobileChat(false);}if(n==="Notifications"){setView("notifications");loadNotifications();}}} className={"soft flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm "+((n==="Messages"&&view==="messages")||(n==="Profile"&&view==="profile")||(n==="Home"&&view==="home")||(n==="Discover"&&view==="discover")||(n==="Communities"&&view==="communities")||(n==="Notifications"&&view==="notifications")?"bg-white/5 text-white":"text-zinc-300 hover:text-white")}><I size={18}/>{n}</button>)}</nav>
      <div className="mt-auto">{userId?<button onClick={signOut} className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-500 hover:text-white"><LogOut size={18}/>Sign out</button>:<button className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-500"><Settings size={18}/>Settings</button>}</div>
    </aside>
    <section className="w-full max-w-[1050px] border-r border-white/5">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[#07090d]/85 px-5 py-4 backdrop-blur-xl"><div><div className="text-[10px] uppercase tracking-[.18em] text-zinc-500">{view==="messages"?"PRIVATE NETWORK":view==="discover"?"EXPLORE NETWORK":view==="communities"?"GROUP NETWORK":"YOUR SPACE"}</div><h1 className="text-lg font-semibold">{view==="profile"?"Profile":view==="messages"?"Messages":view==="notifications"?"Notifications":view==="discover"?"Discover":view==="communities"?"Communities":"Home"}</h1></div><button className="grid h-9 w-9 place-items-center rounded-full bg-white/5"><Search size={18}/></button></header>

      {view==="discover" ? <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"><Search size={16} className="text-zinc-600"/><input value={discoverQuery} onChange={e=>setDiscoverQuery(e.target.value)} placeholder="Search people, posts and ideas" className="w-full bg-transparent text-sm outline-none"/></div>
        <div className="mb-5 flex gap-2 overflow-x-auto">{["For you","People","Posts","Trending"].map((x,i)=><button key={x} className={"rounded-full px-4 py-2 text-[11px] "+(i===0?"bg-white text-black":"bg-white/5 text-zinc-400")}>{x}</button>)}</div>
        <div className="grid gap-4 md:grid-cols-2">{filteredDiscover.map(post=>{const name=post.profiles?.display_name||post.profiles?.username||"Zenchat user";const followed=following.includes(post.author_id);return <article key={post.id} className="glass soft rounded-2xl p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-sm font-semibold">{name[0]}</div><div className="min-w-0 flex-1"><b className="text-xs">{name}</b><p className="text-[10px] text-zinc-600">@{post.profiles?.username||"member"}</p></div>{post.author_id!==userId&&<button onClick={()=>toggleFollow(post.author_id)} className="rounded-full border border-white/10 px-3 py-1 text-[10px]">{followed?"Following":"Follow"}</button>}</div><p className="mt-4 text-sm leading-6 text-zinc-300">{post.content}</p><div className="mt-4 flex gap-4 text-[10px] text-zinc-600"><span>{post.likes.length} likes</span><span>{post.comments.length} comments</span><span>{new Date(post.created_at).toLocaleDateString()}</span></div></article>})}</div>
      </div> : view==="communities" ? <div className="p-4 sm:p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-violet-300">Communities</p><h2 className="mt-1 text-2xl font-semibold">Find your people.</h2><p className="mt-1 max-w-lg text-xs leading-5 text-zinc-500">Join focused spaces, meet people with shared interests and build conversations beyond the feed.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"><Search size={14} className="text-zinc-600"/><input value={communityQuery} onChange={e=>setCommunityQuery(e.target.value)} placeholder="Search communities" className="w-48 bg-transparent text-xs outline-none"/></div></div>
        {!userId?<div className="glass rounded-2xl p-10 text-center text-sm text-zinc-500">Sign in to discover and join communities.</div>:!filteredCommunities.length?<div className="glass rounded-2xl p-10 text-center"><Users className="mx-auto text-zinc-700" size={32}/><h3 className="mt-3 text-sm font-semibold">No communities yet</h3><p className="mt-1 text-xs text-zinc-600">Community discovery is ready. Once spaces are created, they will appear here.</p></div>:<div className="grid gap-4 md:grid-cols-2">{filteredCommunities.map(c=><article key={c.id} className="glass soft overflow-hidden rounded-2xl"><div className="h-28 bg-gradient-to-br from-violet-500/20 via-white/[0.03] to-cyan-400/10">{c.cover_url&&<img src={c.cover_url} alt="" className="h-full w-full object-cover opacity-70"/>}</div><div className="p-5"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-sm font-bold">{c.name[0]}</div><div className="min-w-0 flex-1"><h3 className="font-semibold">{c.name}</h3><p className="text-[10px] text-zinc-600">/{c.slug} · {c.memberCount} {c.memberCount===1?"member":"members"}</p></div><button onClick={()=>toggleCommunity(c)} className={"rounded-full px-3 py-1.5 text-[10px] font-semibold "+(c.joined?"border border-white/10 text-zinc-400":"bg-white text-black")}>{c.joined?"Joined":"Join"}</button></div><p className="mt-4 text-xs leading-5 text-zinc-500">{c.description||"A new Zenchat community."}</p></div></article>)}</div>}
      </div> : view==="notifications" ? <div className="p-4 sm:p-6">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div><b className="text-sm">Activity</b><p className="mt-1 text-[10px] text-zinc-600">{notificationUnread ? notificationUnread+" unread":"All caught up"}</p></div>
            <button onClick={markAllNotificationsRead} disabled={!notificationUnread} className="text-[10px] text-violet-300 disabled:opacity-30">Mark all read</button>
          </div>
          {!notifications.length?<div className="p-12 text-center"><Bell className="mx-auto text-zinc-700" size={30}/><p className="mt-3 text-sm text-zinc-400">No notifications yet</p><p className="mt-1 text-[11px] text-zinc-600">Likes, comments, follows and messages will appear here.</p></div>:
          <div>{notifications.map(n=>{const name=n.actor?.display_name||n.actor?.username||"Someone";const text=n.type==="like"?"liked your post":n.type==="comment"?"commented on your post":n.type==="follow"?"started following you":"sent you a message";return <button key={n.id} onClick={()=>markNotificationRead(n.id)} className={"flex w-full items-center gap-3 border-b border-white/5 px-5 py-4 text-left transition "+(n.read_at?"":"bg-violet-500/[0.06]")}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/20 to-cyan-400/20 text-xs font-semibold">{name[0]?.toUpperCase()||"Z"}</div><div className="min-w-0 flex-1"><p className="text-xs text-zinc-300"><b>{name}</b> <span className="text-zinc-500">{text}</span></p><p className="mt-1 text-[10px] text-zinc-700">{new Date(n.created_at).toLocaleString()}</p></div>{!n.read_at&&<span className="h-2 w-2 rounded-full bg-violet-400"/>}</button>})}</div>}
        </div>
      </div> : {view==="messages" ? <div className="flex h-[calc(100vh-73px)] min-h-[620px]">
        <div className={(mobileChat?"hidden":"flex")+" w-full flex-col border-r border-white/5 md:flex md:w-[310px]"}>
          <div className="flex items-center justify-between px-4 py-4"><div><b className="text-sm">Chats</b><p className="text-[10px] text-zinc-600">{conversations.length} conversations</p></div><button className="grid h-8 w-8 place-items-center rounded-lg bg-white/5"><Plus size={16}/></button></div>
          <div className="px-3 pb-3"><div className="flex items-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2"><Search size={14} className="text-zinc-600"/><input placeholder="Search conversations" className="w-full bg-transparent text-xs outline-none"/></div></div>
          <div className="flex-1 overflow-y-auto px-2">{conversations.map(c=><button key={c.id} onClick={()=>openConversation(c.id)} className={"mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left "+(activeConversation===c.id?"bg-white/7":"hover:bg-white/5")}><div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-sm">{(c.other?.display_name||c.title||"Z")[0]}{c.otherId&&presence[c.otherId]&&<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0d1118] bg-emerald-400"/>}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="truncate text-xs">{c.other?.display_name||c.title||"Conversation"}</b><span className="text-[9px] text-zinc-600">{c.lastAt?new Date(c.lastAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):""}</span></div><p className="truncate text-[11px] text-zinc-600">{c.lastMessage}</p></div></button>)}</div>
          {!conversations.length&&<div className="p-6 text-center text-xs text-zinc-600">No chats yet. Start one from People to follow.</div>}
        </div>
        <div className={(mobileChat?"flex":"hidden")+" flex-1 flex-col md:flex"}>
          {active?<><div className="flex items-center gap-3 border-b border-white/5 px-4 py-3"><button onClick={()=>setMobileChat(false)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 md:hidden"><ArrowLeft size={16}/></button><div className="relative grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs">{(active.other?.display_name||active.title||"Z")[0]}</div><div className="min-w-0 flex-1"><b className="text-sm">{active.other?.display_name||active.title||"Conversation"}</b><p className="text-[10px] text-zinc-600">{active.otherId&&presence[active.otherId]?"Online":"Offline"}</p></div><MoreHorizontal size={18} className="text-zinc-600"/></div>
            <div className="flex-1 overflow-y-auto p-5">{messages.map(m=>{const mine=m.sender_id===userId;const reacted=m.reactions.some(r=>r.user_id===userId);return <div key={m.id} className={"mb-3 flex "+(mine?"justify-end":"justify-start")}><div className="group max-w-[78%]"><div className={"rounded-2xl px-4 py-2.5 text-sm "+(mine?"rounded-br-md bg-violet-500 text-white":"rounded-bl-md bg-white/6 text-zinc-200")}>{m.deleted_at?"Message deleted":m.content}{m.attachment_path&&<div className="mt-2 text-[10px] opacity-70">Attachment: {m.attachment_type||"file"}</div>}</div><div className={"mt-1 flex items-center gap-2 text-[9px] text-zinc-600 "+(mine?"justify-end":"")}><span>{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>{mine&&(m.created_at===messages[messages.length-1]?.created_at?<CheckCheck size={12}/>:<Check size={12}/>)}<button onClick={()=>toggleReaction(m)} className={reacted?"text-pink-400":"opacity-0 group-hover:opacity-100"}><Heart size={11} fill={reacted?"currentColor":"none"}/></button>{m.reactions.length>0&&<span>♥ {m.reactions.length}</span>}</div></div></div>})}{remoteTyping&&<div className="text-[10px] text-zinc-600">typing…</div>}</div>
            <form onSubmit={sendMessage} className="border-t border-white/5 p-3"><div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-2"><button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-zinc-500"><Paperclip size={17}/></button><textarea value={messageText} onChange={e=>{setMessageText(e.target.value);if(!typing){setTyping(true);broadcastTyping(true);} }} onBlur={()=>{setTyping(false);broadcastTyping(false)}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} rows={1} placeholder="Write a message…" className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-xs outline-none"/><button type="button" className="grid h-9 w-9 place-items-center text-zinc-500"><Smile size={17}/></button><button disabled={chatLoading||!messageText.trim()} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black disabled:opacity-30"><Send size={15}/></button></div></form>
          </>:<div className="grid flex-1 place-items-center p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500/10 text-violet-300"><MessageCircle size={28}/></div><h2 className="mt-4 text-lg font-semibold">Your private network</h2><p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">Select a conversation to continue, or start a new one from a person’s profile.</p></div></div>}
        </div>
      </div> : view==="profile" ? <div className="p-5"><div className="glass rounded-2xl p-6"><div className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-2xl font-bold">{(profileName[0]||"Z").toUpperCase()}</div><h2 className="mt-4 text-2xl font-semibold">{profileName||"Zenchat member"}</h2><p className="text-sm text-zinc-500">@{username||"member"}</p><div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/5 py-4 text-center"><div><b>{feed.filter(p=>p.author_id===userId).length}</b><div className="text-[10px] text-zinc-600">Posts</div></div><div><b>{following.length}</b><div className="text-[10px] text-zinc-600">Following</div></div><div><b>—</b><div className="text-[10px] text-zinc-600">Followers</div></div></div></div></div> : <>
        <div className="flex gap-3 overflow-x-auto border-b border-white/5 p-4">
          <button onClick={()=>setStoryComposer(true)} className="min-w-[82px] text-center text-xs text-zinc-400"><div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border border-dashed border-zinc-600 bg-white/[0.02]"><Plus size={18}/></div>Add story</button>
          {stories.map(s=><button key={s.id} onClick={()=>viewStory(s)} className="min-w-[76px] text-center text-xs text-zinc-400"><div className={"mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full border-2 "+(s.viewed?"border-zinc-700":"border-violet-400 bg-gradient-to-br from-violet-500/30 to-cyan-400/20")}>{s.media_path&&s.media_type==="image"?<img src={s.media_path} alt="" className="h-full w-full rounded-full object-cover"/>:<span>{(s.author?.display_name||s.author?.username||"Z")[0]}</span>}</div>{s.author_id===userId?"Your story":s.author?.display_name||s.author?.username||"Member"}</button>)}
        </div>
        {storyComposer&&<form onSubmit={createStory} className="glass soft m-4 rounded-2xl p-4"><div className="flex items-center justify-between"><b className="text-sm">Create a story</b><button type="button" onClick={()=>setStoryComposer(false)}><X size={16}/></button></div><textarea autoFocus value={storyText} onChange={e=>setStoryText(e.target.value)} placeholder="Share a moment…" className="mt-3 min-h-24 w-full resize-none bg-transparent text-sm outline-none"/><button className="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black">Publish story</button></form>}
        {selectedStory&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-5" onClick={()=>setSelectedStory(null)}><div onClick={e=>e.stopPropagation()} className="glass w-full max-w-md rounded-3xl p-6"><div className="flex items-center justify-between"><div><b className="text-sm">{selectedStory.author?.display_name||selectedStory.author?.username||"Member"}</b><p className="text-[10px] text-zinc-600">Story · {new Date(selectedStory.created_at).toLocaleString()}</p></div><button onClick={()=>setSelectedStory(null)}><X size={18}/></button></div>{selectedStory.text_content&&<p className="mt-8 whitespace-pre-wrap text-lg leading-8">{selectedStory.text_content}</p>}{selectedStory.media_path&&selectedStory.media_type==="image"&&<img src={selectedStory.media_path} alt="" className="mt-5 max-h-[55vh] w-full rounded-2xl object-contain"/>}</div></div>}

        <div className="p-4">{showProfileSetup&&userId&&<form onSubmit={saveProfile} className="glass soft mb-4 rounded-2xl p-5"><div className="text-xs font-semibold uppercase tracking-[.16em] text-violet-300">Welcome to Zenchat</div><h2 className="mt-2 text-xl font-semibold">Set up your profile</h2><p className="mt-1 text-xs text-zinc-500">Choose the name and username people will see.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><input required value={profileName} onChange={e=>setProfileName(e.target.value)} placeholder="Display name" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"/><input required value={username} onChange={e=>setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g,"").slice(0,30))} placeholder="username" className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs outline-none"/></div><button className="mt-3 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-black">Continue</button></form>}
          <form onSubmit={createPost} className="glass soft rounded-2xl p-4"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 font-bold">Z</div><div className="flex-1"><textarea value={postText} onChange={e=>setPostText(e.target.value)} disabled={!userId} placeholder={userId?"Share something meaningful…":"Sign in to start posting…"} className="min-h-16 w-full resize-none bg-transparent text-sm outline-none"/><div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><div className="flex gap-1"><button type="button" className="rounded-lg p-2 text-zinc-500"><Image size={18}/></button><button type="button" className="rounded-lg p-2 text-zinc-500"><Video size={18}/></button></div><button disabled={!userId||!postText.trim()} className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-black disabled:opacity-40">Post</button></div></div></div></form>
          {feed.map(post=>{const liked=!!userId&&post.likes.some(l=>l.user_id===userId);const name=post.profiles?.display_name||post.profiles?.username||"Zenchat user";return <article key={post.id} className="glass soft mt-4 rounded-2xl p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-orange-400/20">{name[0]}</div><div><b className="text-sm">{name}</b><div className="text-xs text-zinc-600">@{post.profiles?.username||"member"} · {new Date(post.created_at).toLocaleString()}</div></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{post.content}</p><div className="mt-4 flex justify-between border-t border-white/5 pt-4 text-xs text-zinc-500"><button onClick={()=>toggleLike(post)} className={"flex gap-2 "+(liked?"text-pink-400":"")}><Heart size={17} fill={liked?"currentColor":"none"}/>{post.likes.length}</button><button onClick={()=>setExpandedComments(x=>({...x,[post.id]:!x[post.id]}))} className="flex gap-2"><MessageCircle size={17}/>{post.comments.length}</button><button className="hover:text-white">↗ Share</button></div>{expandedComments[post.id]&&<div className="mt-4 border-t border-white/5 pt-4">{post.comments.slice(-5).map(c=><div key={c.id} className="text-xs mb-2"><b>{c.profiles?.display_name||"User"}</b><span className="ml-2 text-zinc-400">{c.content}</span></div>)}{userId&&<form onSubmit={e=>{e.preventDefault();addComment(post.id)}} className="mt-3 flex gap-2"><input value={commentDrafts[post.id]||""} onChange={e=>setCommentDrafts(d=>({...d,[post.id]:e.target.value}))} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"/><button className="rounded-xl bg-white px-3 text-xs text-black">Send</button></form>}</div>}</article>})}
        </div></>}</section>
    <aside className="hidden w-[330px] p-5 xl:block">{view==="notifications"?<div className="glass rounded-2xl p-4"><b className="text-sm">Notifications</b><p className="mt-2 text-xs leading-5 text-zinc-600">{notificationUnread ? notificationUnread+" new activity":"You are all caught up."}</p></div>:view==="messages"?<div className="glass rounded-2xl p-4"><b className="text-sm">Start a conversation</b><p className="mt-2 text-xs leading-5 text-zinc-600">Message people directly from Zenchat.</p>{people.map(p=><div key={p.id} className="mt-4 flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs">{p.name[0]}</div><div className="min-w-0 flex-1"><b className="block truncate text-xs">{p.name}</b><p className="text-[11px] text-zinc-600">@{p.username}</p></div><button onClick={()=>startConversation(p.id)} disabled={!userId} className="rounded-full bg-white px-3 py-1 text-[10px] text-black">Chat</button></div>)}</div>:<><div className="glass rounded-2xl p-4"><div className="mb-4 flex items-center justify-between"><b className="text-sm">People to follow</b><span className="text-xs text-[var(--accent)]">See all</span></div>{people.map(x=><div className="mb-4 flex items-center gap-3" key={x.id}><div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs">{x.name[0]}</div><div className="flex-1"><b className="text-xs">{x.name}</b><p className="text-[11px] text-zinc-600">@{x.username}</p></div><button disabled={!userId} onClick={()=>toggleFollow(x.id)} className="rounded-full border border-white/10 px-3 py-1 text-[10px]">{following.includes(x.id)?"Following":"Follow"}</button></div>)}</div>
      {!userId&&<div className="mt-4 glass rounded-2xl p-4"><b className="text-sm">Sign in to Zenchat</b><p className="mt-2 text-xs leading-5 text-zinc-500">Use your email. We’ll send a one-time verification code.</p><form onSubmit={sent?verify:otp} className="mt-4 space-y-2"><input required type="email" value={email} disabled={sent} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs"/>{sent&&<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit code" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-sm tracking-[.4em]"/>}<button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-semibold text-black">{loading?(sent?"Verifying…":"Sending…"):(sent?"Verify OTP":"Send OTP")}<Send size={14}/></button></form>{errorMsg&&<p className="mt-3 text-[11px] text-red-400">{errorMsg}</p>}</div>}</>}</aside>
  </div><div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/10 bg-[#10141c]/90 p-1 shadow-2xl backdrop-blur-xl lg:hidden">{[[Home,"Home"],[Compass,"Discover"],[Plus,"Create"],[MessageCircle,"Chat"],[Bell,"Alerts"],[UserRound,"Me"]].map(([I,n]:any)=><button key={n} onClick={()=>{if(n==="Chat"){setView("messages");setMobileChat(false)}if(n==="Home")setView("home");if(n==="Discover")setView("discover");if(n==="Alerts"){setView("notifications");loadNotifications()}if(n==="Me")setView("profile")}} className="grid h-12 w-14 place-items-center text-zinc-400"><I size={19}/></button>)}</div>{errorMsg&&userId&&<div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-500/20 bg-[#151019] px-4 py-3 text-xs text-red-300">{errorMsg}</div>}</main>;
}  if(!userId) return (
    <main className="min-h-screen bg-[#000] text-white selection:bg-white selection:text-black">
      <div className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
        <section className="relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center border-r border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_35%,rgba(124,58,237,.22),transparent_38%),radial-gradient(circle_at_70%_70%,rgba(34,211,238,.12),transparent_34%)]"/>
          <div className="relative z-10 max-w-xl px-16">
            <div className="mb-10 grid h-16 w-16 place-items-center rounded-full bg-white text-black text-3xl font-black">z</div>
            <h1 className="text-6xl font-black leading-[.95] tracking-[-.06em]">Connect with<br/>what matters.</h1>
            <p className="mt-7 max-w-md text-sm leading-6 text-zinc-500">A real-time social space for people, ideas, conversations and communities.</p>
            <div className="mt-10 grid grid-cols-3 gap-3 text-[10px] uppercase tracking-[.16em] text-zinc-600"><span>People</span><span>Stories</span><span>Communities</span></div>
          </div>
        </section>
        <section className="flex min-h-screen items-center px-6 py-10 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-[430px]">
            <div className="mb-12 lg:hidden grid h-12 w-12 place-items-center rounded-full bg-white text-black text-2xl font-black">z</div>
            <p className="text-[11px] font-semibold uppercase tracking-[.22em] text-zinc-600">ZENCHAT</p>
            <h2 className="mt-3 text-4xl font-bold tracking-[-.04em]">Join the conversation.</h2>
            <p className="mt-3 text-sm text-zinc-500">Sign up or sign in with your email. We’ll send a secure 6-digit code.</p>
            <div className="mt-9 rounded-3xl border border-white/10 bg-[#080808] p-6 shadow-2xl">
              <div className="mb-6 grid grid-cols-2 rounded-xl bg-white/[.04] p-1">
                <button type="button" className="rounded-lg bg-white py-2.5 text-xs font-semibold text-black">Sign in</button>
                <button type="button" className="rounded-lg py-2.5 text-xs text-zinc-500">Sign up</button>
              </div>
              <form onSubmit={sent?verify:otp} className="space-y-3">
                <label className="block text-[11px] font-medium text-zinc-400">Email address</label>
                <input required type="email" value={email} disabled={sent} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" className="h-12 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 text-sm outline-none transition focus:border-white/30"/>
                {sent&&<><label className="block pt-2 text-[11px] font-medium text-zinc-400">Verification code</label><input required autoFocus inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" className="h-14 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 text-center text-xl tracking-[.55em] outline-none focus:border-white/30"/><button type="button" onClick={()=>{setSent(false);setCode("")}} className="text-[11px] text-zinc-500 hover:text-white">Use a different email</button></>}
                <button disabled={loading} className="h-12 w-full rounded-xl bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-50">{loading?(sent?"Verifying…":"Sending code…"):(sent?"Verify and continue":"Continue with email")}</button>
              </form>
              {errorMsg&&<p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{errorMsg}</p>}
              <p className="mt-5 text-[10px] leading-5 text-zinc-600">By continuing, you agree to Zenchat’s Terms and Privacy Policy. No password required.</p>
            </div>
            <div className="mt-7 flex items-center gap-3 text-[10px] text-zinc-700"><span className="h-px flex-1 bg-white/5"/>SECURE EMAIL OTP<span className="h-px flex-1 bg-white/5"/></div>
          </div>
        </section>
      </div>
    </main>
  );


