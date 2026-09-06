import React, { useState, useEffect, useCallback } from "react";
import { api } from "./api.js";
import { useRoute } from "./hooks/useRoute.js";
import LoginScreen from "./components/LoginScreen.jsx";
import DirectoryScreen from "./components/DirectoryScreen.jsx";
import CoupleProfileScreen from "./components/CoupleProfileScreen.jsx";
import FormFillingScreen from "./components/FormFillingScreen.jsx";
import SettingsScreen from "./components/SettingsScreen.jsx";
import { Spinner } from "./components/Shared.jsx";

export default function App() {
  const [authStatus, setAuthStatus] = useState("checking"); // checking | signedOut | signedIn
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

  useEffect(() => {
    api.me()
      .then((me) => { setProfile(me); setAuthStatus("signedIn"); return loadData(); })
      .catch(() => setAuthStatus("signedOut"));
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

  if (authStatus === "checking") return <Spinner label="Checking your Google sign-in…" />;
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