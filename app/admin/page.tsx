
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

type Match = {
  id: number;
  title: string;
  voting_open: boolean;
  results_revealed: boolean;
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<number, any[]>>({});

  async function loadMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("id");

    if (error) {
      setMessage("Impossible de charger les matchs.");
      return;
    }

    setMatches(data || []);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setLoggedIn(true);
        loadMatches();
      }
    });
  }, []);

  async function login() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Identifiants incorrects. Vérifie ton email et ton mot de passe.");
    } else {
      setLoggedIn(true);
      await loadMatches();
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setMatches([]);
    setResults({});
    setMessage("Tu es déconnectée.");
  }

  async function changeStatus(
    matchId: number,
    votingOpen: boolean,
    resultsRevealed: boolean
  ) {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_set_match_status", {
      p_match_id: matchId,
      p_voting_open: votingOpen,
      p_results_revealed: resultsRevealed,
    });

    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Statut du match mis à jour !");
      setResults((previous) => {
        const updated = { ...previous };
        delete updated[matchId];
        return updated;
      });
      await loadMatches();
    }

    setLoading(false);
  }

  async function showResults(matchId: number) {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.rpc("get_match_results", {
      p_match_id: matchId,
    });

    if (error) {
      setMessage("Impossible de récupérer les résultats : " + error.message);
    } else {
      setResults((previous) => ({
        ...previous,
        [matchId]: data || [],
      }));
    }

    setLoading(false);
  }
async function resetMatch(matchId: number) {
  const confirmed = window.confirm(
    "Attention ! Tous les votes de ce match seront supprimés. Continuer ?"
  );

  if (!confirmed) return;

  setLoading(true);
  setMessage("");

  const { error } = await supabase.rpc("admin_reset_match", {
    p_match_id: matchId,
  });

  if (error) {
    setMessage("Erreur lors de la réinitialisation : " + error.message);
  } else {
    setMessage("Le match a été réinitialisé avec succès ! 💗");
    setResults((previous) => {
      const updated = { ...previous };
      delete updated[matchId];
      return updated;
    });
    await loadMatches();
  }

  setLoading(false);
}

async function resetAllMatches() {
  const confirmed = window.confirm(
    "ATTENTION ! Tous les votes des 3 matchs seront définitivement supprimés. Continuer ?"
  );

  if (!confirmed) return;

  setLoading(true);
  setMessage("");

  const { error } = await supabase.rpc("admin_reset_all_matches");

  if (error) {
    setMessage("Erreur lors de la réinitialisation : " + error.message);
  } else {
    setMessage("Les trois matchs ont été réinitialisés ! 💗");
    setResults({});
    await loadMatches();
  }

  setLoading(false);
}
  return (
    <main style={{
      minHeight: "100vh",
      background: "#090909",
      color: "white",
      padding: "35px 20px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: 650, margin: "auto" }}>
        <h1 style={{ color: "#ff3f91", fontSize: 38 }}>
          ADMINISTRATION
        </h1>
        <p style={{ color: "#b9aeb5", marginBottom: 30 }}>
          JOURNÉE 100% FILLES · Gestion des votes
        </p>

        {!loggedIn ? (
          <section style={{
            background: "#171217",
            padding: 24,
            borderRadius: 15,
            border: "1px solid #382331"
          }}>
            <h2 style={{ marginBottom: 20 }}>Connexion administrateur</h2>

            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />

            <button onClick={login} disabled={loading} style={buttonStyle}>
              {loading ? "Connexion..." : "SE CONNECTER"}
            </button>
          </section>
        ) : (
          <>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 25
            }}>
              <h2>Gestion des matchs</h2>
              <button onClick={logout} style={smallButtonStyle}>
                Déconnexion
              </button>
            </div>

            {matches.map((match) => (
            <button
  disabled={loading}
  onClick={resetAllMatches}
  style={{
    ...buttonStyle,
    background: "#a82050",
    marginBottom: 25
  }}
>
  🧹 TOUT RÉINITIALISER
</button>
              <section key={match.id} style={{
                background: "#171217",
                padding: 22,
                borderRadius: 15,
                border: "1px solid #382331",
                marginBottom: 16
              }}>
                <h2 style={{ marginBottom: 12 }}>{match.title}</h2>

                <p style={{
                  color: match.results_revealed
                    ? "#ff80b5"
                    : match.voting_open
                    ? "#80e0a0"
                    : "#b9aeb5",
                  marginBottom: 18
                }}>
                  {match.results_revealed
                    ? "Résultats révélés"
                    : match.voting_open
                    ? "Vote ouvert"
                    : "Vote fermé"}
                </p>

                {!match.results_revealed && !match.voting_open && (
                  <button
                    disabled={loading}
                    onClick={() => changeStatus(match.id, true, false)}
                    style={buttonStyle}
                  >
                    OUVRIR LE VOTE
                  </button>
                )}

                {match.voting_open && (
                  <button
                    disabled={loading}
                    onClick={() => changeStatus(match.id, false, false)}
                    style={buttonStyle}
                  >
                    FERMER LE VOTE
                  </button>
                )}

                {!match.voting_open && !match.results_revealed && (
                  <button
                    disabled={loading}
                    onClick={() => changeStatus(match.id, false, true)}
                    style={buttonStyle}
                  >
                    RÉVÉLER LES RÉSULTATS AU PUBLIC
                  </button>
                )}

                <button
                  disabled={loading}
                  onClick={() => showResults(match.id)}
                  style={smallButtonStyle}
                >
                  CONSULTER LES RÉSULTATS EN PRIVÉ
                </button>

                {results[match.id] && (
                  <div style={{ marginTop: 18 }}>
                    <h3 style={{ color: "#ff80b5" }}>Résultats</h3>
                    {results[match.id].map((row, index) => (
                      <div key={index} style={{
                        padding: 10,
                        borderBottom: "1px solid #382331",
                        fontSize: 13
                      }}>
                        {Object.entries(row).map(([key, value]) => (
                          <span key={key} style={{ marginRight: 12 }}>
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        )}

        {message && (
          <p style={{
            color: "#ff80b5",
            marginTop: 20,
            fontSize: 14
          }}>
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 14,
  marginBottom: 14,
  borderRadius: 8,
  border: "1px solid #493344",
  background: "#090909",
  color: "white",
  fontSize: 15
};

const buttonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 15,
  marginTop: 12,
  border: "none",
  borderRadius: 8,
  background: "#ff3f91",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const smallButtonStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 12,
  marginTop: 12,
  border: "1px solid #ff3f91",
  borderRadius: 8,
  background: "transparent",
  color: "#ff80b5",
  fontWeight: "bold",
  cursor: "pointer"
};
