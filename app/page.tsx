
"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
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

export default function Home() {
  const [event, setEvent] = useState<Event | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("*")
          .eq("is_active", true)
          .maybeSingle();

        if (eventError) {
          setMessage("Impossible de charger l'événement.");
          return;
        }

        if (!eventData) {
          setMessage("Aucun événement n'est actuellement disponible.");
          return;
        }

        setEvent(eventData);

        const { data: matchData, error: matchError } = await supabase
          .from("matches")
          .select("*")
          .eq("event_id", eventData.id)
          .order("id");

        if (matchError) {
          setMessage("Impossible de charger les matchs.");
          return;
        }

        const loadedMatches = matchData || [];
        setMatches(loadedMatches);

        if (loadedMatches.length === 0) {
          setPlayers([]);
          return;
        }

        const matchIds = loadedMatches.map((match) => match.id);

        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("*")
          .in("match_id", matchIds)
          .order("jersey_number");

        if (playerError) {
          setMessage("Impossible de charger les joueuses.");
          return;
        }

        setPlayers(playerData || []);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (selectedMatch !== null && event) {
      setSelectedPlayer(null);
      setMessage("");

      const currentRound =
        matches.find((m) => m.id === selectedMatch)?.vote_round ?? 1;

      setAlreadyVoted(
        localStorage.getItem(
          `vote-event-${event.id}-match-${selectedMatch}-${currentRound}`
        ) === "done"
      );
    }
  }, [selectedMatch, matches, event]);

  const currentMatch = matches.find((m) => m.id === selectedMatch);

  async function submitVote() {
    if (!selectedMatch || !selectedPlayer || !event || !currentMatch) return;

    if (!currentMatch.voting_open) {
      setMessage("Le vote est fermé pour ce match.");
      return;
    }

    if (alreadyVoted) {
      setMessage("Un vote a déjà été enregistré sur cet appareil pour ce match.");
      return;
    }

    const { error } = await supabase.from("votes").insert({
      match_id: selectedMatch,
      player_id: selectedPlayer,
    });

    if (error) {
      setMessage(
        "Le vote n'a pas pu être enregistré. Vérifie que le vote est ouvert."
      );
    } else {
      const currentRound = currentMatch.vote_round ?? 1;

      localStorage.setItem(
        `vote-event-${event.id}-match-${selectedMatch}-${currentRound}`,
        "done"
      );

      setAlreadyVoted(true);
      setMessage("Ton vote a bien été enregistré ! 💗");
      setSelectedPlayer(null);
    }
  }

  useEffect(() => {
    async function loadResults() {
      if (!selectedMatch || !currentMatch?.results_revealed) {
        setResults([]);
        return;
      }

      setResultsLoading(true);

      const { data, error } = await supabase.rpc("get_match_results", {
        p_match_id: selectedMatch,
      });

      if (error) {
        setMessage("Impossible de charger les résultats.");
        setResults([]);
      } else {
        setResults(data || []);
      }

      setResultsLoading(false);
    }

    loadResults();
  }, [selectedMatch, currentMatch?.results_revealed]);

  const currentPlayers = players.filter(
    (player) => player.match_id === selectedMatch
  );

  const logo = event?.logo_url?.trim() || "/logo-club.png";

  const pageStyle: CSSProperties = {
    "--pink": event?.theme_primary || "#ff3f91",
    "--pink-light": event?.theme_secondary || "#ff80b5",
    "--black": event?.theme_background || "#090909",
    "--card": event?.theme_card || "#171217",
    "--white": event?.theme_text || "#ffffff",
  } as CSSProperties;

  return (
    <main className="page" style={pageStyle}>
      {loading ? (
        <section className="content">
          <p>Chargement de l'événement...</p>
        </section>
      ) : !event ? (
        <section className="content">
          <h2>Oups !</h2>
          <p>{message || "Aucun événement n'est disponible pour le moment."}</p>
        </section>
      ) : (
        <>
          <header className="hero">
            <img src={logo} alt="Logo du club" className="club-logo" />

            <p className="eyebrow">{event.eyebrow}</p>

            <h1>{event.main_title}</h1>

            <p className="subtitle">{event.subtitle}</p>
          </header>

          <section className="content">
            <h2>Les matchs</h2>

            {matches.length === 0 ? (
              <p>Aucun match n'a encore été ajouté à cet événement.</p>
            ) : (
              <div className="match-list">
                {matches.map((match) => (
                  <button
                    key={match.id}
                    className={`match-card ${
                      selectedMatch === match.id ? "active" : ""
                    }`}
                    onClick={() => setSelectedMatch(match.id)}
                  >
                    <span>{match.title}</span>
                    <span className="status">
                      {match.results_revealed
                        ? "Résultats disponibles"
                        : match.voting_open
                        ? "Vote ouvert"
                        : "Vote fermé"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {currentMatch && (
              <div className="voting">
                <h2>{currentMatch.title}</h2>

                {currentMatch.results_revealed ? (
                  <div className="results">
                    <h3>🏆 CLASSEMENT DU MATCH</h3>

                    {resultsLoading ? (
                      <p>Chargement du classement...</p>
                    ) : results.length === 0 ? (
                      <p>Aucun résultat disponible.</p>
                    ) : (
                      <div className="results-list">
                        {results.map((result, index) => (
                          <div
                            className={`result-card rank-${index + 1}`}
                            key={result.player_number}
                          >
                            <span className="result-rank">
                              {index === 0
                                ? "🥇"
                                : index === 1
                                ? "🥈"
                                : index === 2
                                ? "🥉"
                                : `${index + 1}.`}
                            </span>

                            <span className="result-name">
                              #{result.player_number} {result.player_name}
                            </span>

                            <span className="result-votes">
                              {result.vote_count} vote
                              {result.vote_count > 1 ? "s" : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : !currentMatch.voting_open ? (
                  <p>Le vote pour ce match n'est pas ouvert pour le moment.</p>
                ) : alreadyVoted ? (
                  <p>
                    Merci ! Ton vote a déjà été enregistré pour ce match 💗
                  </p>
                ) : (
                  <>
                    <p className="instruction">
                      Sélectionne ta joueuse préférée :
                    </p>

                    <div className="player-list">
                      {currentPlayers.map((player) => (
                        <button
                          key={player.id}
                          className={`player-card ${
                            selectedPlayer === player.id ? "chosen" : ""
                          }`}
                          onClick={() => setSelectedPlayer(player.id)}
                        >
                          <span className="number">
                            #{player.jersey_number}
                          </span>
                          <span>{player.name}</span>
                        </button>
                      ))}
                    </div>

                    <button
                      className="vote-button"
                      disabled={!selectedPlayer}
                      onClick={submitVote}
                    >
                      VALIDER MON VOTE
                    </button>
                  </>
                )}

                {message && <p className="message">{message}</p>}
              </div>
            )}
          </section>

          <footer>
            <img src={logo} alt="Logo du club" className="club-logo" />
            <p>{event.footer_text}</p>
          </footer>
        </>
      )}
    </main>
  );
}
