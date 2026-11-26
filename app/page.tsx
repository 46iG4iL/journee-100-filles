
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

export default function Home() {
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
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
      setLoading(true);

      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();

      if (eventError || !eventData) {
        setMessage(
          eventError
            ? "Impossible de charger l'événement."
            : "Aucun événement n'est disponible pour le moment."
        );
        setLoading(false);
        return;
      }

      const event = eventData as Event;
      setActiveEvent(event);

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("event_id", event.id)
        .order("id");

      if (matchError) {
        setMessage("Impossible de charger les matchs.");
        setLoading(false);
        return;
      }

      const loadedMatches = (matchData || []) as Match[];
      setMatches(loadedMatches);

      if (loadedMatches.length > 0) {
        const matchIds = loadedMatches.map((match) => match.id);

        const { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("*")
          .in("match_id", matchIds)
          .order("jersey_number");

        if (playerError) {
          setMessage("Impossible de charger les joueuses.");
          setLoading(false);
          return;
        }

        setPlayers((playerData || []) as Player[]);
      } else {
        setPlayers([]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const currentMatch = matches.find((m) => m.id === selectedMatch);

  useEffect(() => {
    if (selectedMatch === null || !activeEvent) {
      setSelectedPlayer(null);
      setAlreadyVoted(false);
      return;
    }

    setSelectedPlayer(null);
    setMessage("");

    const currentRound =
      matches.find((m) => m.id === selectedMatch)?.vote_round ?? 1;

    const voteKey = `vote-event-${activeEvent.id}-match-${selectedMatch}-${currentRound}`;

    setAlreadyVoted(localStorage.getItem(voteKey) === "done");
  }, [selectedMatch, matches, activeEvent]);

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
        setResults((data || []) as Result[]);
      }

      setResultsLoading(false);
    }

    loadResults();
  }, [selectedMatch, currentMatch?.results_revealed]);

  async function submitVote() {
    if (!selectedMatch || !selectedPlayer || !activeEvent) return;

    if (alreadyVoted) {
      setMessage(
        "Un vote a déjà été enregistré sur cet appareil pour ce match."
      );
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
      const currentRound =
        matches.find((m) => m.id === selectedMatch)?.vote_round ?? 1;

      const voteKey = `vote-event-${activeEvent.id}-match-${selectedMatch}-${currentRound}`;

      localStorage.setItem(voteKey, "done");
      setAlreadyVoted(true);
      setMessage("Ton vote a bien été enregistré ! 💗");
      setSelectedPlayer(null);
    }
  }

  const currentPlayers = players.filter(
    (player) => player.match_id === selectedMatch
  );

  const pageStyle = activeEvent
    ? ({
        "--pink": activeEvent.theme_primary || "#ff3f91",
        "--pink-light": activeEvent.theme_secondary || "#ff80b5",
        "--black": activeEvent.theme_background || "#090909",
        "--card": activeEvent.theme_card || "#171217",
        "--white": activeEvent.theme_text || "#ffffff",
      } as CSSProperties)
    : undefined;

  const logo = activeEvent?.logo_url || "/logo-club.png";

  return (
    <main className="page" style={pageStyle}>
      {loading ? (
        <div className="loading-screen">
          <p>Chargement de l'événement...</p>
        </div>
      ) : !activeEvent ? (
        <div className="loading-screen">
          <h1>Pas d'événement pour le moment</h1>
          <p>{message}</p>
        </div>
      ) : (
        <>
          <header className="hero">
            <img
              src={logo}
              alt="Logo de l'événement"
              className="club-logo"
            />

            <p className="eyebrow">{activeEvent.eyebrow}</p>

            <h1>{activeEvent.main_title}</h1>

            <p className="subtitle">{activeEvent.subtitle}</p>
          </header>

          <section className="content">
            <h2>Les matchs</h2>

            {matches.length === 0 ? (
              <p>Aucun match n'est encore disponible.</p>
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
                            key={`${result.player_number}-${index}`}
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
                  <p>
                    Le vote pour ce match n'est pas ouvert pour le moment.
                  </p>
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
            <img
              src={logo}
              alt="Logo de l'événement"
              className="club-logo"
            />
            <p>{activeEvent.footer_text}</p>
          </footer>
        </>
      )}
    </main>
  );
}
