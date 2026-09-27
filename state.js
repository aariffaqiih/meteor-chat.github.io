let knowledgeJadwalKuliah = "";
fetch("jadwal-kuliah.json")
    .then(res => res.text())
    .then(text => knowledgeJadwalKuliah = text)
    .catch(err => console.warn("Could not load jadwal-kuliah.json"));

let history = [];
let editIndex = null;
let isLoading = false;
let abortController = null;
let currentView = "landing";
let currentImageBase64 = null;

const $ = (id) => document.getElementById(id);
const landingEl = $("landing");
const chatViewEl = $("chat-view");
const msgLanding = $("message-landing");
const msgChat = $("message-chat");
const sendLanding = $("send-landing");
const sendChat = $("send-chat");
const cancelBtn = $("cancel-btn");
const editNotice = $("edit-notice");
const errorBox = $("error-box");
const conversationEl = $("conversation");
const chatMessagesEl = $("chat-messages");
const noKeysNotice = $("no-keys-notice");

function getActiveInput() {
    return currentView === "landing" ? msgLanding : msgChat;
}

function getActiveSendBtn() {
    return currentView === "landing" ? sendLanding : sendChat;
}

function protectIdentity(text) {
    return text;
}
