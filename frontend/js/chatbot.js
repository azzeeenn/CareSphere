/* ==========================================================
   CareSphere Chatbot Widget
   ----------------------------------------------------------
   Two modes, controlled by CS_CHAT_CONFIG.mode below:

   "builtin" (default) -> answers come from the CS_FAQ knowledge
        base in this file. No server, no API key, works offline.

   "ai" -> every message is sent to your own backend endpoint
        (CS_CHAT_CONFIG.apiUrl), which should call an LLM and
        return { reply: "..." }. NEVER put an OpenAI/Anthropic
        API key directly in this file - it would be visible to
        anyone who views page source. Keep the real API key on
        your server (see chatbot_backend.py for a ready example).

   If "ai" mode is selected but the request fails (e.g. you
   haven't set up the backend yet), the widget automatically
   falls back to the built-in answers, so the chatbot never
   just breaks for a visitor.
========================================================== */

const CS_CHAT_CONFIG = {
    mode: "builtin",              // "builtin" or "ai"
    apiUrl: "/api/chatbot",       // only used when mode is "ai"
    orgName: "CareSphere",
    typingDelay: 550              // ms, purely cosmetic
};

/* ==========================================================
   BUILT-IN KNOWLEDGE BASE
   Each entry: keywords to match (any match = trigger) + reply.
   Add/edit freely - no code changes needed elsewhere.
========================================================== */

const CS_FAQ = [
    {
        keywords: ["hi", "hello", "hey", "start"],
        reply: "Hi there! 👋 I'm the CareSphere assistant. I can help with volunteering, programs, events, or donations. What would you like to know?"
    },
    {
        keywords: ["volunteer", "join", "sign up", "how to help", "get involved"],
        reply: "You can become a volunteer by filling out our application form. Head to the <a href='volunteer-application.html'>Volunteer Application</a> page, or visit <a href='volunteer.html'>Volunteer</a> to learn about roles and the process first."
    },
    {
        keywords: ["application", "apply", "form", "status"],
        reply: "Our volunteer application is a short multi-step form covering your details, availability, and interests. Start it here: <a href='volunteer-application.html'>Volunteer Application</a>. It only takes a few minutes."
    },
    {
        keywords: ["event", "events", "upcoming", "tree plantation", "blood donation", "workshop"],
        reply: "We regularly run events like tree plantations, blood donation camps, and education workshops. Check out everything upcoming on our <a href='events.html'>Events</a> page, including our big Annual Community Impact Day."
    },
    {
        keywords: ["program", "programs", "education", "healthcare", "environment", "initiative"],
        reply: "CareSphere runs programs in education, healthcare outreach, environmental conservation, food distribution, women empowerment, and disaster relief. See details on our <a href='programs.html'>Programs</a> page."
    },
    {
        keywords: ["donate", "donation", "money", "fund", "contribute financially"],
        reply: "Thank you for wanting to support us! You can donate via the 'Donate Now' button on our Programs page, and 100% of contributions go toward active community programs."
    },
    {
        keywords: ["contact", "email", "phone", "number", "address", "reach"],
        reply: "You can reach us at info@caresphere.org or +91 98765 43210, or send a message from our <a href='contact.html'>Contact</a> page. We're based in Bengaluru, Karnataka."
    },
    {
        keywords: ["partner", "school", "college", "institution", "ngo", "csr", "collaborate"],
        reply: "Schools, colleges, NGOs and companies can work with us through our partnership programs. Tell us about your organisation on the <a href='institutions.html'>Partner With Us</a> page and we'll reply within 2-3 working days."
    },
    {
        keywords: ["recognition", "badge", "reward", "hall of fame", "volunteer of the month", "award"],
        reply: "We track your hours and hand out certificates, badges and rewards as you hit milestones. See what you can earn on the <a href='recognition.html'>Recognition</a> page."
    },
    {
        keywords: ["certificate", "benefit", "why volunteer", "perks"],
        reply: "Volunteers earn participation and milestone certificates, badges, reference letters and partner discounts - plus real hands-on experience. See <a href='recognition.html'>Recognition</a> for the full list, or <a href='volunteer.html'>Volunteer</a> to get started."
    },
    {
        keywords: ["location", "where", "bengaluru", "bangalore"],
        reply: "CareSphere is based in Bengaluru, Karnataka, and most of our events happen across the city (Cubbon Park, Freedom Park, and local schools/hospitals)."
    },
    {
        keywords: ["login", "account", "sign in"],
        reply: "You can log in using the 'Login' button at the top right of any page. If you don't have an account yet, use 'Join Us' to register."
    },
    {
        keywords: ["thank", "thanks", "great", "cool", "awesome"],
        reply: "You're very welcome! 💛 Let me know if there's anything else about volunteering, events, or programs I can help with."
    },
    {
        keywords: ["bye", "goodbye", "see you"],
        reply: "Take care, and thank you for supporting CareSphere! 🌱"
    }
];

const CS_FALLBACK_REPLY =
    "I'm not totally sure about that one yet. You can reach our team directly at info@caresphere.org, or try asking about volunteering, events, programs, or donations!";

const CS_QUICK_REPLIES = [
    "How do I volunteer?",
    "Upcoming events",
    "Our programs",
    "Partner with us",
    "Contact info"
];

/* ==========================================================
   MATCHING LOGIC (built-in mode)
========================================================== */

function csFindReply(message){

    const lower = message.toLowerCase();

    for(const entry of CS_FAQ){

        if(entry.keywords.some(keyword => lower.includes(keyword))){

            return entry.reply;

        }

    }

    return CS_FALLBACK_REPLY;

}

/* ==========================================================
   AI MODE (calls your backend, see chatbot_backend.py)
========================================================== */

async function csGetAiReply(message, history){

    const response = await fetch(CS_CHAT_CONFIG.apiUrl, {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history })

    });

    if(!response.ok){

        throw new Error("Chatbot backend error");

    }

    const data = await response.json();

    return data.reply || CS_FALLBACK_REPLY;

}

/* ==========================================================
   WIDGET BEHAVIOR
   (expects the markup from chatbot-widget.html to already
   be present in the page before this script runs)
========================================================== */

function csInitChat(){

    const launcher = document.getElementById("cs-chat-launcher");

    if(!launcher){

        console.warn("CareSphere chatbot: chatbot-widget.html markup not found on this page.");
        return;

    }

    const chatWindow = document.getElementById("cs-chat-window");
    const closeBtn = document.getElementById("cs-chat-close");
    const messages = document.getElementById("cs-chat-messages");
    const input = document.getElementById("cs-chat-input");
    const sendBtn = document.getElementById("cs-chat-send");
    const quickReplies = document.getElementById("cs-quick-replies");

    if(messages){

        messages.setAttribute("role", "log");
        messages.setAttribute("aria-live", "polite");
        messages.setAttribute("aria-label", "Chat messages");

    }

    const history = [];
    let greeted = false;

    function addMessage(text, sender){

        const msg = document.createElement("div");
        msg.className = `cs-msg ${sender}`;
        msg.setAttribute("role", sender === "bot" ? "status" : "note");
        msg.innerHTML = text;
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;

    }

    function showTyping(){

        const typing = document.createElement("div");
        typing.className = "cs-typing";
        typing.id = "cs-typing-indicator";
        typing.innerHTML = "<span></span><span></span><span></span>";
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;

    }

    function hideTyping(){

        const typing = document.getElementById("cs-typing-indicator");

        if(typing){

            typing.remove();

        }

    }

    function renderQuickReplies(){

        quickReplies.innerHTML = "";

        CS_QUICK_REPLIES.forEach(text => {

            const chip = document.createElement("button");
            chip.className = "cs-chip";
            chip.textContent = text;
            chip.addEventListener("click", () => handleUserMessage(text));
            quickReplies.appendChild(chip);

        });

    }

    async function handleUserMessage(text){

        const trimmed = text.trim();

        if(trimmed === ""){

            return;

        }

        addMessage(trimmed, "user");
        history.push({ role: "user", content: trimmed });
        input.value = "";

        showTyping();

        try{

            let reply;

            if(CS_CHAT_CONFIG.mode === "ai"){

                try{

                    reply = await csGetAiReply(trimmed, history);

                }

                catch(err){

                    console.warn("AI backend unavailable, falling back to built-in answers.", err);
                    reply = csFindReply(trimmed);

                }

            }

            else{

                reply = csFindReply(trimmed);

            }

            setTimeout(() => {

                hideTyping();
                addMessage(reply, "bot");
                history.push({ role: "assistant", content: reply });

            }, CS_CHAT_CONFIG.typingDelay);

        }

        catch(err){

            hideTyping();
            addMessage(CS_FALLBACK_REPLY, "bot");

        }

    }

    launcher.addEventListener("click", () => {

        chatWindow.classList.toggle("open");

        if(chatWindow.classList.contains("open") && !greeted){

            greeted = true;
            showTyping();

            setTimeout(() => {

                hideTyping();
                addMessage(
                    `Hi! 👋 I'm the ${CS_CHAT_CONFIG.orgName} assistant. Ask me about volunteering, events, programs, or donations.`,
                    "bot"
                );
                renderQuickReplies();

            }, CS_CHAT_CONFIG.typingDelay);

        }

        if(chatWindow.classList.contains("open")){

            input.focus();

        }

    });

    closeBtn.addEventListener("click", () => {

        chatWindow.classList.remove("open");
        launcher.focus();

    });

    document.addEventListener("keydown", (e) => {

        if(e.key === "Escape" && chatWindow.classList.contains("open")){

            chatWindow.classList.remove("open");
            launcher.focus();

        }

    });

    sendBtn.addEventListener("click", () => handleUserMessage(input.value));

    input.addEventListener("keydown", (e) => {

        if(e.key === "Enter"){

            e.preventDefault();
            handleUserMessage(input.value);

        }

    });

}

document.addEventListener("DOMContentLoaded", csInitChat);
