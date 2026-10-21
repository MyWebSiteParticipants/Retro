import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./app/AuthContext";
import { parseHash, type Route, type View } from "./app/routes";
import { BuildStamp } from "./components/BuildStamp";
import { MainMenu } from "./components/MainMenu";
import { TEAM_PRESETS } from "./config/teams";
import { Board } from "./features/board/Board";
import { HelpPanel } from "./features/help/HelpPanel";
import { History } from "./features/history/History";
import { Sessions } from "./features/sessions/Sessions";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { useLocalStorage } from "./hooks/useLocalStorage";

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const auth = useAuth();
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  const [teamRepo, setTeamRepo] = useLocalStorage<string>("retro.team.v1", TEAM_PRESETS[0].repo);
  const [lastBoard, setLastBoard] = useLocalStorage<string>("retro.lastBoard.v1", "");
  const [settings, setSettings] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Opening a board also makes its repo the current team, so Sessions/History follow it.
  useEffect(() => {
    if (route.view === "board" && route.repo) {
      setTeamRepo(route.repo);
      setLastBoard(location.hash);
    }
  }, [route, setTeamRepo, setLastBoard]);

  const go = (v: View) => {
    setSettings(false);
    if (v === "sessions") location.hash = "#/";
    else if (v === "history") location.hash = "#/history";
    else if (lastBoard) location.hash = lastBoard;
  };

  const teamName = TEAM_PRESETS.find((t) => t.repo === teamRepo)?.name ?? teamRepo.split("/")[1];

  return (
    <div className={`app${help ? " app--help" : ""}`}>
      <header className="app__header">
        <div className="app__header-left">
          <MainMenu
            view={settings ? "sessions" : route.view}
            boardAvailable={!!lastBoard}
            teamRepo={teamRepo}
            viewer={auth.viewer ?? null}
            onView={go}
            onOpenSettings={() => setSettings(true)}
            onOpenHelp={() => setHelp(true)}
            onSignOut={() => void auth.signOut()}
          />
          <div className="app__title">Retro</div>
          <span className="pill pill--muted">{teamName}</span>
        </div>
        <div className="app__pills">
          {auth.viewer && <img className="avatar" src={auth.viewer.avatarUrl} alt="" title={auth.viewer.login} />}
          <button
            type="button"
            className={`help-btn${help ? " help-btn--on" : ""}`}
            aria-label={help ? "Close help" : "Open help"}
            aria-pressed={help}
            onClick={() => setHelp((h) => !h)}
          >
            ?
          </button>
        </div>
      </header>

      <main className="app__main">
        {settings ? (
          <SettingsPanel
            teamRepo={teamRepo}
            onTeamChange={(r) => {
              setTeamRepo(r);
              setLastBoard("");
            }}
            onBack={() => setSettings(false)}
          />
        ) : route.view === "board" && route.repo && route.number ? (
          <Board repo={route.repo} number={route.number} />
        ) : route.view === "history" ? (
          <History teamRepo={teamRepo} />
        ) : (
          <Sessions teamRepo={teamRepo} />
        )}
      </main>

      {help && <HelpPanel onClose={() => setHelp(false)} />}
      <BuildStamp />
    </div>
  );
}
