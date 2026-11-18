// Onward landing page test.
// Each visitor gets a message (a or b) and a price (49 or 69), chosen at random
// once and kept in this browser. Force them for testing: ?m=b&p=69
(function () {
  "use strict";

  var SUPABASE_URL = "https://hxkdjbjagqlvurloflfh.supabase.co";
  var SUPABASE_KEY = "sb_publishable_LbVvWxzOjckmlwERJ5l01w_GdmXZI9X"; // publishable: safe in a web page
  // Stripe Payment Link for the US$5 deposit. Set this when the link exists.
  var STRIPE_DEPOSIT_LINK = "";

  var COPY = {
    a: {
      headline: "Miss a day. Your plan fixes itself.",
      lead: "When a sick day or a field trip throws off the week, one tap moves the unfinished lessons forward, in order. No red overdue pile, and no Sunday night redraw.",
      order: ["missed", "shared", "records", "private"],
    },
    b: {
      headline: "A homeschool record you can trust.",
      lead: "Plan one read-aloud for all your kids and tick off who was really there. When life happens, move the work forward, and what you did on each day never changes.",
      order: ["records", "shared", "missed", "private"],
    },
  };

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) {
      return null;
    }
    return value;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  var params = new URLSearchParams(window.location.search);
  var visitor = store("onward_vid") || store("onward_vid", uuid());

  var m = params.get("m");
  if (m !== "a" && m !== "b") m = store("onward_m");
  if (m !== "a" && m !== "b") m = Math.random() < 0.5 ? "a" : "b";
  store("onward_m", m);

  var p = Number(params.get("p"));
  if (p !== 49 && p !== 69) p = Number(store("onward_p"));
  if (p !== 49 && p !== 69) p = Math.random() < 0.5 ? 49 : 69;
  store("onward_p", String(p));

  var source = params.get("utm_source") || store("onward_src") || "";
  var campaign = params.get("utm_campaign") || store("onward_cmp") || "";
  if (source) store("onward_src", source);
  if (campaign) store("onward_cmp", campaign);
  var referrer = "";
  try {
    if (document.referrer) referrer = new URL(document.referrer).hostname;
  } catch (e) {}

  // ---- apply the variant ----
  var copy = COPY[m];
  document.querySelector('[data-copy="headline"]').textContent = copy.headline;
  document.querySelector('[data-copy="lead"]').textContent = copy.lead;
  document.querySelector('[data-copy="price"]').textContent = "US$" + p;
  var grid = document.querySelector('[data-order="features"]');
  copy.order.forEach(function (key) {
    var el = grid.querySelector('[data-feature="' + key + '"]');
    if (el) grid.appendChild(el);
  });

  // ---- tracking ----
  function rpc(fn, body) {
    return fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  }
  function track(event) {
    return rpc("track", {
      p_visitor: visitor,
      p_event: event,
      p_message: m,
      p_price: p,
      p_source: source || null,
      p_campaign: campaign || null,
      p_referrer: referrer || null,
    }).catch(function () {});
  }
  track("view");

  document.querySelectorAll('[data-track="cta_click"]').forEach(function (a) {
    a.addEventListener("click", function () { track("cta_click"); });
  });

  var deposit = document.getElementById("deposit");
  deposit.addEventListener("click", function (e) {
    e.preventDefault();
    track("deposit_click");
    if (!STRIPE_DEPOSIT_LINK) {
      alert("Deposits open soon. Please join the waitlist for now.");
      return;
    }
    // client_reference_id shows in Stripe, so each deposit is tied to the version seen
    var ref = m + "-" + p + "-" + visitor.replace(/-/g, "").slice(0, 16);
    var url = STRIPE_DEPOSIT_LINK + (STRIPE_DEPOSIT_LINK.indexOf("?") > -1 ? "&" : "?") + "client_reference_id=" + encodeURIComponent(ref);
    setTimeout(function () { window.location.href = url; }, 150);
  });

  // ---- waitlist ----
  var form = document.getElementById("waitlist-form");
  var msg = document.getElementById("form-msg");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("email").value.trim();
    var kids = document.getElementById("kids").value;
    var consent = document.getElementById("consent").checked;
    msg.className = "small";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      msg.textContent = "Please check the email address.";
      msg.className = "small err";
      return;
    }
    if (!consent) {
      msg.textContent = "Please tick the box so we can email you.";
      msg.className = "small err";
      return;
    }
    var button = form.querySelector("button");
    button.disabled = true;
    rpc("join_waitlist", {
      p_visitor: visitor,
      p_email: email,
      p_message: m,
      p_price: p,
      p_source: source || null,
      p_kids: kids || null,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("save failed");
        msg.textContent = "Thanks. You're on the list, and we'll write once when the beta opens.";
        msg.className = "small ok";
        form.reset();
      })
      .catch(function () {
        msg.textContent = "That didn't save. Please try again in a minute.";
        msg.className = "small err";
      })
      .finally(function () {
        button.disabled = false;
      });
  });

  // ---- demo on the phone mockup ----
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) {
    var banner = document.querySelector('[data-demo="banner"]');
    var button2 = document.querySelector('[data-demo="button"]');
    var earlier = document.querySelectorAll('[data-demo="earlier"]');
    var pushed = document.querySelectorAll('[data-demo="pushed"]');
    var played = false;
    function play() {
      button2.classList.add("pressed");
      setTimeout(function () {
        button2.classList.remove("pressed");
        banner.classList.add("gone");
        earlier.forEach(function (row) {
          row.classList.remove("grey");
          var small = row.querySelector("small");
          if (small) small.textContent = "Moved to today";
        });
        // one lesson a day: what was today's lesson now moves to tomorrow
        pushed.forEach(function (row) {
          row.classList.add("grey");
          row.querySelector("small").textContent = "Moves to tomorrow";
        });
        if (!played) { played = true; track("demo_play"); }
      }, 350);
      setTimeout(function () {
        banner.classList.remove("gone");
        earlier.forEach(function (row) {
          row.classList.add("grey");
          var small = row.querySelector("small");
          if (small) small.textContent = "Not done yet";
        });
        pushed.forEach(function (row) {
          row.classList.remove("grey");
          row.querySelector("small").textContent = "";
        });
      }, 5200);
    }
    setTimeout(play, 2200);
    setInterval(play, 8000);
  }
})();
