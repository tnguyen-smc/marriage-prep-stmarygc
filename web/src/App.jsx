import React, { useState, useEffect, useCallback } from "react";
import { api, isServerWaking } from "./api.js";
import { useRoute } from "./hooks/useRoute.js";
import { ink, FONT_SERIF, FONT_SANS } from "./theme.js";
import LoginScreen from "./components/LoginScreen.jsx";
import DirectoryScreen from "./components/DirectoryScreen.jsx";
import CoupleProfileScreen from "./components/CoupleProfileScreen.jsx";
import FormFillingScreen from "./components/FormFillingScreen.jsx";
import SettingsScreen from "./components/SettingsScreen.jsx";
import { Spinner, AnimatedEllipsis } from "./components/Shared.jsx";

export default function App() {
  const [authStatus, setAuthStatus] = useState("checking"); // checking | signedOut | signedIn
  // True while the backend is asleep/booting and we're still retrying.
  const [serverWaking, setServerWaking] = useState(false);
  const [profile, setProfile] = useState(null);
  const [couples, setCouples] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [priests, setPriests] = useState([]);
  const { route, go } = useRoute();
  const authError = new URLSearchParams(window.location.search).get("auth_error");

  const loadData = useCallback(async () => {
    const [c, t, p] = await Promise.all([api.couples.list(), api.templates.list(), api.priests.list()]);
    setCouples(c);
    setTemplates(t);
    setPriests(p);
  }, []);

  // Render puts idle instances to sleep, and a cold boot can take the
  // better part of a minute. During that window api.me() doesn't answer
  // "not signed in" — it fails to connect at all, or the proxy returns
  // 502/503/504. Treating that as signedOut is what used to dump people
  // on the login screen (or leave them staring at "Checking your Google
  // sign-in…") until they refreshed by hand. So: retry those failures on
  // a timer, and once the server does answer, carry on into the app with
  // no refresh needed. A real 401 still falls through to signedOut
  // immediately.
  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const attempt = async () => {
      try {
        const me = await api.me();
        if (cancelled) return;
        setProfile(me);
        setAuthStatus("signedIn");
        setServerWaking(false);
        await loadData();
      } catch (e) {
        if (cancelled) return;
        if (isServerWaking(e)) {
          setServerWaking(true);
          timer = setTimeout(attempt, 3000);
        } else {
          setServerWaking(false);
          setAuthStatus("signedOut");
        }
      }
    };

    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loadData]);

  const handleLogout = async () => {
    await api.logout();
    setAuthStatus("signedOut");
    setProfile(null);
    setCouples([]);
    setTemplates([]);
    setPriests([]);
    go("/");
  };

  const handleCreateCouple = async (payload) => {
    const created = await api.couples.create(payload);
    setCouples((prev) => [...prev, created]);
    go(`/couples/${created.slug}`);
  };

  const handleCoupleUpdated = (updated) => {
    setCouples((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleCoupleDeleted = (id) => {
    setCouples((prev) => prev.filter((c) => c.id !== id));
    go("/");
  };

  const isAdmin = profile?.role === "admin";

  if (authStatus === "checking") {
    return serverWaking ? (
      <div className="h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: "#FAF7F0" }}>
        <div className="text-[19px]" style={{ fontFamily: FONT_SERIF, color: ink }}>
          Server is booting. Please wait<AnimatedEllipsis />
        </div>
        <div className="text-[13px] mt-2" style={{ color: "#8A8378", fontFamily: FONT_SANS }}>
          This can take up to a minute after a quiet spell. The app opens on its own — no need to refresh.
        </div>
      </div>
    ) : (
      <Spinner label="Checking your Google sign-in…" />
    );
  }
  if (authStatus === "signedOut") return <LoginScreen authError={authError} />;

  if (route.name === "settings" && isAdmin) {
    return (
      <SettingsScreen
        templates={templates}
        priests={priests}
        onBack={() => go("/")}
        onTemplatesChanged={() => api.templates.list().then(setTemplates)}
        onPriestsChanged={() => api.priests.list().then(setPriests)}
        onCoupleImported={(couple) => setCouples((prev) => [...prev, couple])}
      />
    );
  }

  if (route.name === "profile" || route.name === "forms") {
    const couple = couples.find((c) => c.slug === route.slug);
    // Couples load asynchronously, so a hard refresh on a /couples/... URL
    // lands here before the list arrives — show a spinner rather than a
    // spurious "not found".
    if (!couple) {
      return couples.length === 0
        ? <Spinner label="Loading couple…" />
        : <Spinner label="That couple's page could not be found." />;
    }

    if (route.name === "forms") {
      return (
        <FormFillingScreen
          couple={couple}
          templates={templates}
          onBack={() => go(`/couples/${couple.slug}`)}
        />
      );
    }

    return (
      <CoupleProfileScreen
        couple={couple}
        templates={templates}
        priests={priests}
        isAdmin={isAdmin}
        onBack={() => go("/")}
        onOpenForms={() => go(`/couples/${couple.slug}/forms`)}
        onCoupleUpdated={handleCoupleUpdated}
        onCoupleDeleted={handleCoupleDeleted}
      />
    );
  }

  return (
    <DirectoryScreen
      couples={couples}
      templates={templates}
      priests={priests}
      profile={profile}
      onOpenCouple={(c) => go(`/couples/${c.slug}`)}
      onSettings={() => go("/settings")}
      onLogout={handleLogout}
      onCreateCouple={handleCreateCouple}
    />
  );
}