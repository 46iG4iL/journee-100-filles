
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
);

type Event = {
  id: number;
  name: string;
  eyebrow: string;
  main_title: string;
  subtitle: string;
  footer_text: string;
  theme_primary: string;
  theme_secondary: string;
  theme_background: string;
  theme_card: string;
  theme_text: string;
  logo_url: string | null;
  is_active: boolean;
};

type Match = {
  id: number;
  event_id: number;
  title: string;
  voting_open: boolean;
  results_revealed: boolean;
  vote_round: number;
};

type Player = {
  id: number;
  match_id: number;
  jersey_number: number;
  name: string;
};

type Result = {
  
  player_number: number;
  player_name: string;
  vote_count: number;
};
type EditableEventField =
  | "name"
  | "eyebrow"
  | "main_title"
  | "subtitle"
  | "footer_text"
  | "logo_url"
  | "theme_primary"
  | "theme_secondary"
  | "theme_background"
  | "theme_card"
  | "theme_text";

const panelStyle = {
  background: "#171217",
  border: "1px solid #392b36",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "18px",
};

const inputStyle = {
  width: "100%",
  padding: "11px",
  marginTop: "6px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #55404e",
  background: "#090909",
  color: "white",
  boxSizing: "border-box" as const,
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  margin: "4px",
};

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Record<number, Result[]>>({});

  const [newMatchTitle, setNewMatchTitle] = useState("");
  const [newPlayerNumbers, setNewPlayerNumbers] = useState<Record<number, string>>({});
  const [newPlayerNames, setNewPlayerNames] = useState<Record<number, string>>({});
  const [newEventName, setNewEventName] = useState("");

  async function loadEventData(eventId: number) {
    const { data: matchData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", eventId)
      .order("id");

    if (matchError) {
      setMessage("Erreur lors du chargement des matchs : " + matchError.message);
      return;
    }

    const loadedMatches = (matchData || []) as Match[];
    setMatches(loadedMatches);

    if (loadedMatches.length === 0) {
      setPlayers([]);
      setResults({});
      return;
    }

    const matchIds = loadedMatches.map((match) => match.id);
    const { data: playerData, error: playerError } = await supabase
      .from("players")
      .select("*")
      .in("match_id", matchIds)
      .order("jersey_number");

    if (playerError) {
      setMessage("Erreur lors du chargement des joueuses : " + playerError.message);
      return;
    }

    setPlayers((playerData || []) as Player[]);
    setResults({});
  }

  async function refreshAll() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Erreur lors du chargement des événements : " + error.message);
      return;
    }

    const loadedEvents = (data || []) as Event[];
    setEvents(loadedEvents);

    const active = loadedEvents.find((event) => event.is_active) || null;
    setActiveEvent(active);

    if (active) {
      await loadEventData(active.id);
    } else {
      setMatches([]);
      setPlayers([]);
      setResults({});
    }
  }

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setLoggedIn(true);
        await refreshAll();
      }
    }
    checkSession();
  }, []);

  async function login() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("Connexion impossible : " + error.message);
    } else {
      setLoggedIn(true);
      await refreshAll();
    }

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
    setEvents([]);
    setActiveEvent(null);
    setMatches([]);
    setPlayers([]);
    setResults({});
    setMessage("Tu es déconnectée.");
  }

  async function activateEvent(eventId: number) {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_set_active_event", {
      p_event_id: eventId,
    });

    if (error) {
      setMessage("Impossible de changer d'événement : " + error.message);
    } else {
      setMessage("Événement actif modifié !");
      await refreshAll();
    }

    setLoading(false);
  }

  async function createEvent() {
    if (!newEventName.trim()) {
      setMessage("Entre un nom pour ton nouvel événement.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc("admin_create_event", {
      p_name: newEventName.trim(),
    });

    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      const newId = Number(data);
      const { error: activeError } = await supabase.rpc("admin_set_active_event", {
        p_event_id: newId,
      });

      if (activeError) {
        setMessage("Événement créé, mais activation impossible : " + activeError.message);
      } else {
        setNewEventName("");
        setMessage("Nouvel événement créé et activé !");
        await refreshAll();
      }
    }

    setLoading(false);
  }

  function updateEventField(field: EditableEventField, value: string) {
    if (!activeEvent) return;
    setActiveEvent({ ...activeEvent, [field]: value });
  }

  async function saveEvent() {
    if (!activeEvent) return;

    setLoading(true);
    const { error } = await supabase.rpc("admin_update_event", {
      p_event_id: activeEvent.id,
      p_name: activeEvent.name,
      p_eyebrow: activeEvent.eyebrow,
      p_main_title: activeEvent.main_title,
      p_subtitle: activeEvent.subtitle,
      p_footer_text: activeEvent.footer_text,
      p_theme_primary: activeEvent.theme_primary,
      p_theme_secondary: activeEvent.theme_secondary,
      p_theme_background: activeEvent.theme_background,
      p_theme_card: activeEvent.theme_card,
      p_theme_text: activeEvent.theme_text,
      p_logo_url: activeEvent.logo_url || null,
    });

    if (error) {
      setMessage("Erreur lors de l'enregistrement : " + error.message);
    } else {
      setMessage("Personnalisation enregistrée !");
      await refreshAll();
    }
    setLoading(false);
  }

  async function deleteEvent(event: Event) {
    if (event.is_active) {
      setMessage("Tu dois d'abord activer un autre événement avant de supprimer celui-ci.");
      return;
    }

    if (!confirm(`Supprimer l'événement « ${event.name} » ?`)) return;

    const { error } = await supabase.rpc("admin_delete_event", {
      p_event_id: event.id,
    });

    if (error) {
      setMessage("Suppression impossible : " + error.message);
    } else {
      setMessage("Événement supprimé.");
      await refreshAll();
    }
  }

  async function addMatch() {
    if (!activeEvent || !newMatchTitle.trim()) {
      setMessage("Entre un titre pour le match.");
      return;
    }

    const { error } = await supabase.rpc("admin_create_match", {
      p_event_id: activeEvent.id,
      p_title: newMatchTitle.trim(),
    });

    if (error) {
      setMessage("Impossible d'ajouter le match : " + error.message);
    } else {
      setNewMatchTitle("");
      setMessage("Match ajouté !");
      await loadEventData(activeEvent.id);
    }
  }

  async function editMatch(match: Match) {
    const title = prompt("Nouveau nom du match :", match.title);
    if (title === null || !title.trim()) return;

    const { error } = await supabase.rpc("admin_update_match", {
      p_match_id: match.id,
      p_title: title.trim(),
    });

    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Match modifié !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function deleteMatch(match: Match) {
    if (!confirm(`Supprimer « ${match.title} » ? Le match doit être vide.`)) return;

    const { error } = await supabase.rpc("admin_delete_match", {
      p_match_id: match.id,
    });

    if (error) {
      setMessage("Suppression impossible : " + error.message);
    } else {
      setMessage("Match supprimé !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function addPlayer(matchId: number) {
    const number = Number(newPlayerNumbers[matchId]);
    const name = (newPlayerNames[matchId] || "").trim();

    if (!Number.isInteger(number) || number < 0 || !name) {
      setMessage("Indique un numéro valide et un nom de joueuse.");
      return;
    }

    const { error } = await supabase.rpc("admin_create_player", {
      p_match_id: matchId,
      p_jersey_number: number,
      p_name: name,
    });

    if (error) {
      setMessage("Impossible d'ajouter la joueuse : " + error.message);
    } else {
      setNewPlayerNumbers({ ...newPlayerNumbers, [matchId]: "" });
      setNewPlayerNames({ ...newPlayerNames, [matchId]: "" });
      setMessage("Joueuse ajoutée !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function editPlayer(player: Player) {
    const numberText = prompt("Numéro de maillot :", String(player.jersey_number));
    if (numberText === null) return;

    const name = prompt("Nom de la joueuse :", player.name);
    if (name === null) return;

    const number = Number(numberText);
    if (!Number.isInteger(number) || number < 0 || !name.trim()) {
      setMessage("Numéro ou nom invalide.");
      return;
    }

    const { error } = await supabase.rpc("admin_update_player", {
      p_player_id: player.id,
      p_jersey_number: number,
      p_name: name.trim(),
    });

    if (error) {
      setMessage("Modification impossible : " + error.message);
    } else {
      setMessage("Joueuse modifiée !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function deletePlayer(player: Player) {
    if (!confirm(`Supprimer ${player.name} ?`)) return;

    const { error } = await supabase.rpc("admin_delete_player", {
      p_player_id: player.id,
    });

    if (error) {
      setMessage("Suppression impossible : " + error.message);
    } else {
      setMessage("Joueuse supprimée !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function changeStatus(
    match: Match,
    votingOpen: boolean,
    resultsRevealed: boolean
  ) {
    const { error } = await supabase.rpc("admin_set_match_status", {
      p_match_id: match.id,
      p_voting_open: votingOpen,
      p_results_revealed: resultsRevealed,
    });

    if (error) {
      setMessage("Erreur : " + error.message);
    } else {
      setMessage("Statut du match mis à jour !");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function showResults(matchId: number) {
    const { data, error } = await supabase.rpc("get_match_results", {
      p_match_id: matchId,
    });

    if (error) {
      setMessage("Impossible de charger les résultats : " + error.message);
    } else {
      setResults({ ...results, [matchId]: (data || []) as Result[] });
    }
  }

  async function resetMatch(match: Match) {
    if (!confirm(`Effacer les votes de « ${match.title} » et relancer ce match ?`)) return;

    const { error } = await supabase.rpc("admin_reset_match", {
      p_match_id: match.id,
    });

    if (error) {
      setMessage("Réinitialisation impossible : " + error.message);
    } else {
      setMessage("Les votes de ce match ont été réinitialisés.");
      if (activeEvent) await loadEventData(activeEvent.id);
    }
  }

  async function resetEvent() {
    if (!activeEvent) return;

    const confirmed = confirm(
      `ATTENTION : tous les votes de « ${activeEvent.name} » seront supprimés. Les autres événements ne seront pas touchés. Continuer ?`
    );

    if (!confirmed) return;

    const { error } = await supabase.rpc("admin_reset_event_matches", {
      p_event_id: activeEvent.id,
    });

    if (error) {
      setMessage("Réinitialisation impossible : " + error.message);
    } else {
      setMessage("Tous les votes de cet événement ont été réinitialisés.");
      await loadEventData(activeEvent.id);
    }
  }

  const field = (
    label: string,
    key: EditableEventField,
    type = "text"
  ) => (
    <label style={{ display: "block", marginBottom: "8px" }}>
      {label}
      <input
        type={type}
        value={String(activeEvent?.[key] ?? "")}
        onChange={(e) => updateEventField(key, e.target.value)}
        style={inputStyle}
      />
    </label>
  );

  if (!loggedIn) {
    return (
      <main style={{ minHeight: "100vh", background: "#090909", color: "white", padding: "30px 16px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ maxWidth: "420px", margin: "70px auto", ...panelStyle }}>
          <h1 style={{ color: "#ff3f91", textAlign: "center" }}>ADMINISTRATION</h1>
          <p style={{ textAlign: "center", color: "#cbbdc6" }}>Connecte-toi pour gérer tes événements 💗</p>

          <label>Adresse e-mail</label>
          <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

          <label>Mot de passe</label>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

          <button style={{ ...buttonStyle, width: "100%", background: "#ff3f91", color: "white" }} onClick={login} disabled={loading}>
            {loading ? "Connexion..." : "SE CONNECTER"}
          </button>

          {message && <p>{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090909", color: "white", padding: "24px 16px 60px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "950px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ color: "#ff3f91", marginBottom: "4px" }}>TABLEAU DE BORD 💗</h1>
            <p style={{ color: "#cbbdc6", marginTop: 0 }}>Gestion de tes événements et de tes votes</p>
          </div>
          <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={logout}>Déconnexion</button>
        </div>

        {message && (
          <div style={{ ...panelStyle, color: "#ffb5d3", marginTop: "16px" }}>
            {message}
          </div>
        )}

        <section style={panelStyle}>
          <h2>🎉 Mes événements</h2>
          <p style={{ color: "#cbbdc6" }}>Choisis l'événement que tu souhaites gérer.</p>

          <select
            value={activeEvent?.id ?? ""}
            onChange={(e) => activateEvent(Number(e.target.value))}
            style={inputStyle}
          >
            {events.length === 0 && <option value="">Aucun événement</option>}
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}{event.is_active ? " — ACTIF" : ""}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input
              style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
              placeholder="Nom du nouvel événement"
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
            />
            <button style={{ ...buttonStyle, background: "#ff3f91", color: "white" }} onClick={createEvent}>
              + Créer un événement
            </button>
          </div>

          {events.filter((event) => !event.is_active).map((event) => (
            <div key={event.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", borderTop: "1px solid #392b36", paddingTop: "8px" }}>
              <span>{event.name}</span>
              <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={() => deleteEvent(event)}>
                Supprimer
              </button>
            </div>
          ))}
        </section>

        {activeEvent && (
          <>
            <section style={panelStyle}>
              <h2>🎨 Personnaliser l'événement</h2>
              <p style={{ color: "#cbbdc6" }}>Ces réglages seront enregistrés pour cet événement.</p>

              {field("Nom de l'événement", "name")}
              {field("Petit texte au-dessus du titre", "eyebrow")}
              {field("Titre principal", "main_title")}
              {field("Sous-titre", "subtitle")}
              {field("Texte du pied de page", "footer_text")}
              {field("Adresse ou chemin du logo (ex. /logo-club.png)", "logo_url")}

              <h3>Couleurs</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                {([
                  ["Couleur principale", "theme_primary"],
                  ["Couleur secondaire", "theme_secondary"],
                  ["Fond de page", "theme_background"],
                  ["Fond des cartes", "theme_card"],
                  ["Couleur du texte", "theme_text"],
                ] as [string, keyof Event][]).map(([label, key]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="color"
                      value={String(activeEvent[key] || "#ffffff")}
                      onChange={(e) => updateEventField(key, e.target.value)}
                      style={{ ...inputStyle, height: "48px", padding: "4px" }}
                    />
                  </label>
                ))}
              </div>

              <button style={{ ...buttonStyle, background: "#ff3f91", color: "white" }} onClick={saveEvent} disabled={loading}>
                Enregistrer la personnalisation
              </button>
            </section>

            <section style={panelStyle}>
              <h2>🏟️ Les matchs</h2>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: "180px" }}
                  placeholder="Ex. Match 1, Finale..."
                  value={newMatchTitle}
                  onChange={(e) => setNewMatchTitle(e.target.value)}
                />
                <button style={{ ...buttonStyle, background: "#ff3f91", color: "white" }} onClick={addMatch}>
                  + Ajouter un match
                </button>
              </div>

              {matches.length === 0 && <p style={{ color: "#cbbdc6" }}>Aucun match pour cet événement.</p>}

              {matches.map((match) => {
                const matchPlayers = players.filter((player) => player.match_id === match.id);

                return (
                  <div key={match.id} style={{ ...panelStyle, background: "#0f0b0f" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <h3>{match.title}</h3>
                      <span style={{ color: match.voting_open ? "#72e6a1" : "#ffb5d3" }}>
                        {match.voting_open ? "● Votes ouverts" : "● Votes fermés"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      <button style={{ ...buttonStyle, background: "#ff3f91", color: "white" }} onClick={() => changeStatus(match, true, false)}>
                        Ouvrir les votes
                      </button>
                      <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={() => changeStatus(match, false, false)}>
                        Fermer les votes
                      </button>
                      <button style={{ ...buttonStyle, background: "#5b3b76", color: "white" }} onClick={() => changeStatus(match, false, true)}>
                        Révéler les résultats
                      </button>
                      <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={() => showResults(match.id)}>
                        Voir les résultats
                      </button>
                      <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={() => editMatch(match)}>
                        Renommer
                      </button>
                      <button style={{ ...buttonStyle, background: "#713d4d", color: "white" }} onClick={() => resetMatch(match)}>
                        Réinitialiser ce match
                      </button>
                      <button style={{ ...buttonStyle, background: "#713d4d", color: "white" }} onClick={() => deleteMatch(match)}>
                        Supprimer le match
                      </button>
                    </div>

                    {results[match.id] && (
                      <div style={{ marginTop: "12px" }}>
                        <h4>Résultats</h4>
                        {results[match.id].length === 0 ? (
                          <p>Aucun vote pour le moment.</p>
                        ) : (
                          results[match.id].map((result, index) => (
                            <p key={`${result.player_number}-${index}`}>
                              #{result.player_number} — {result.player_name} : <strong>{result.vote_count} vote(s)</strong>
                            </p>
                          ))
                        )}
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #392b36", marginTop: "16px", paddingTop: "8px" }}>
                      <h4>Joueuses ({matchPlayers.length})</h4>

                      {matchPlayers.map((player) => (
                        <div key={player.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap", padding: "5px 0" }}>
                          <span>#{player.jersey_number} — {player.name}</span>
                          <span>
                            <button style={{ ...buttonStyle, background: "#392b36", color: "white" }} onClick={() => editPlayer(player)}>Modifier</button>
                            <button style={{ ...buttonStyle, background: "#713d4d", color: "white" }} onClick={() => deletePlayer(player)}>Supprimer</button>
                          </span>
                        </div>
                      ))}

                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: "8px", alignItems: "center", marginTop: "12px" }}>
                        <input
                          style={inputStyle}
                          type="number"
                          min="0"
                          placeholder="N°"
                          value={newPlayerNumbers[match.id] || ""}
                          onChange={(e) => setNewPlayerNumbers({ ...newPlayerNumbers, [match.id]: e.target.value })}
                        />
                        <input
                          style={inputStyle}
                          placeholder="Nom de la joueuse"
                          value={newPlayerNames[match.id] || ""}
                          onChange={(e) => setNewPlayerNames({ ...newPlayerNames, [match.id]: e.target.value })}
                        />
                        <button style={{ ...buttonStyle, background: "#ff3f91", color: "white" }} onClick={() => addPlayer(match.id)}>
                          + Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>

            <section style={panelStyle}>
              <h2>🔄 Réinitialiser cet événement</h2>
              <p style={{ color: "#cbbdc6" }}>
                Cette action supprime les votes de tous les matchs de « {activeEvent.name} », ferme les votes et masque les résultats. Les autres événements ne seront pas touchés.
              </p>
              <button style={{ ...buttonStyle, background: "#a83255", color: "white" }} onClick={resetEvent}>
                Réinitialiser tous les matchs de cet événement
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
