import assert from 'assert';
import { cloneDeep, isEqual, pickBy, shuffle, uniq, uniqBy } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';

export type OriginalCard = {
  type: 'original';
  id: string;
  name: string;
  description: string;
  duplication: number;
};

export type DuplicateCard = { type: 'duplicate'; id: string; parentId: string };

export type Card = OriginalCard | DuplicateCard;

export type CardIndex = { [id: string]: Card };

export type AppState = {
  cards: { [id: string]: Card };
  deck: string[];
  hands: string[][];
};

let handler: NodeJS.Timeout | null = null;
const debounce =
  (fn: (...args: any[]) => void, delay: number) =>
  (...args: any[]) => {
    if (handler) {
      clearTimeout(handler);
    }
    handler = setTimeout(() => fn(...args), delay);
  };

export type CardMove = {
  id: string;
  destination:
    | {
        type: 'deck';
        position: number;
      }
    | { type: 'hand'; handIndex: number; position: number };
};

const getDiff = (original: AppState, next: AppState) => {
  // const changes: Change[] = [];

  const originalCardIds = Object.keys(original.cards);
  const nextCardIds = Object.keys(next.cards);

  const deletes = originalCardIds.filter((id) => !nextCardIds.includes(id));
  const adds = nextCardIds
    .filter((id) => !originalCardIds.includes(id))
    .map((id) => next.cards[id]);

  const updates: OriginalCard[] = [];
  for (const nextCard of Object.values(next.cards)) {
    const originalCard = original.cards[nextCard.id];
    if (
      originalCard &&
      !isEqual(nextCard, originalCard) &&
      nextCard.type === 'original'
    ) {
      updates.push(nextCard);
    }
  }

  const moves: CardMove[] = [];
  next.deck.forEach((id, index) => {
    if (original.deck[index] !== id) {
      moves.push({
        id,
        destination: { type: 'deck', position: index },
      });
    }
  });
  next.hands.forEach((hand, handIndex) => {
    hand.forEach((id, index) => {
      if (original.hands[handIndex][index] !== id) {
        moves.push({
          id,
          destination: { type: 'hand', handIndex, position: index },
        });
      }
    });
  });

  return { adds, deletes, updates, moves };
};

export const useSyncedState = () => {
  // const [cards, setCards] = useState<CardIndex>({});
  // ordering of cards in deck
  // const [deck, setDeck] = useState<string[]>([]);
  // const [hands, setHands] = useState<string[][]>([[]]);

  const [appState, setAppState] = useState<AppState>({
    cards: {},
    deck: [],
    hands: [[]],
  });

  // for baffling reasons, the fetchLatestData callback isn't getting updates to
  // appState, *but* if you put it in a ref it's fine?
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const branchpoint = useRef<AppState | null>(null);

  const fetchLatestData = async () => {
    return (await (await fetch('api/getData')).json())['data'] as AppState;
  };

  const fetchAndWriteLatestData = async () => {
    const serverState: AppState = await fetchLatestData();

    let finalState: AppState;
    if (branchpoint.current) {
      finalState = mergeStates(
        branchpoint.current,
        serverState,
        appStateRef.current
      );
    } else {
      finalState = serverState;
    }

    branchpoint.current = finalState;
    setAppState(finalState);
  };

  useEffect(() => {
    const handler = setInterval(fetchAndWriteLatestData, 5000);
    fetchAndWriteLatestData();
    return () => clearTimeout(handler);
  }, []);

  const putData = debounce(async (data: AppState) => {
    const latest = await fetchLatestData();
    const merged = mergeStates(branchpoint.current!, latest, data);
    branchpoint.current = merged;
    setAppState(merged);

    console.log('putting', merged);
    await fetch('api/putData', {
      method: 'POST',
      body: JSON.stringify(merged),
    });
  }, 2000);

  const lastPut = useRef<AppState | null>(null);
  useEffect(() => {
    if (!isEqual(lastPut.current, appState) && branchpoint.current) {
      lastPut.current = appState;
      putData(appState);
    }
  }, [appState, putData]);

  const mergeStates = (
    branchpoint: AppState,
    serverState: AppState,
    localState: AppState
  ) => {
    console.log('branchpoint', branchpoint);
    console.log('serverState', serverState);
    console.log('localState', localState);

    const finalState = cloneDeep(branchpoint);

    const {
      adds: serverAdds,
      deletes: serverDeletes,
      updates: serverUpdates,
      moves: serverMoves,
    } = getDiff(branchpoint, serverState);
    const {
      adds: localAdds,
      deletes: localDeletes,
      updates: localUpdates,
      moves: localMoves,
    } = getDiff(branchpoint, localState);

    const adds = [...serverAdds, ...localAdds];
    const deletes = uniq([...serverDeletes, ...localDeletes]);
    const updates = uniqBy([...serverUpdates, ...localUpdates], 'id');
    const moves = uniqBy([...serverMoves, ...localMoves], 'id');

    console.log('merge outcome', { adds, deletes, updates, moves });

    for (const del of deletes) {
      applyDelete(finalState, del);
    }

    for (const add of adds) {
      applyAdd(finalState, add);
    }

    for (const update of updates) {
      applyUpdate(finalState, update);
    }

    for (const move of moves) {
      applyMove(finalState, move);
    }

    return finalState;
  };

  const removeCardsEverywehre = (appState: AppState, ids: string[]) => {
    appState.deck = appState.deck.filter((id) => !ids.includes(id));
    appState.hands = appState.hands.map((h) => {
      return [...h].filter((id) => !ids.includes(id));
    });
  };

  const applyAdd = (appState: AppState, card: Card) => {
    appState.cards[card.id] = card;
    appState.deck = [card.id, ...appState.deck];
  };
  const submitAdd = (card: Card) => {
    const nextState = cloneDeep(appState);
    applyAdd(nextState, card);
    setAppState(nextState);
  };

  const applyDelete = (appState: AppState, id: string) => {
    const originalCard = appState.cards[id] as OriginalCard;

    if (!originalCard) {
      return;
    }

    const idsToDelete = Object.values(appState.cards)
      .filter(
        (c) =>
          (c.type === 'original' && c.id === originalCard.id) ||
          (c.type === 'duplicate' && c.parentId === originalCard.id)
      )
      .map((c) => c.id);

    appState.cards = pickBy(appState.cards, (c) => !idsToDelete.includes(c.id));
    removeCardsEverywehre(appState, idsToDelete);
  };
  const submitDelete = (id: string) => {
    const nextState = cloneDeep(appState);
    applyDelete(nextState, id);
    setAppState(nextState);
  };

  const applyUpdate = (appState: AppState, card: OriginalCard) => {
    const originalCard = appState.cards[card.id] as OriginalCard;

    const duplicationChange = card.duplication - originalCard.duplication;

    // console.log('duplication change', duplicationChange);

    let newDuplicates: DuplicateCard[] = [];
    let dupeIdsToDelete: string[] = [];
    if (duplicationChange > 0) {
      for (let i = 0; i < duplicationChange; i++) {
        newDuplicates.push({
          type: 'duplicate',
          id: uuid(),
          parentId: originalCard.id,
        });
      }
    } else if (duplicationChange < 0) {
      const dupeIds = Object.values(appState.cards)
        .filter((c) => c.type === 'duplicate' && c.parentId === originalCard.id)
        .map((c) => c.id);
      console.log('dupeIds', dupeIds);
      console.log('duplication change', duplicationChange);
      dupeIdsToDelete = dupeIds.slice(0, duplicationChange * -1);
      console.log('dupeIdsToDelete', dupeIds);
    }

    for (const newDupe of newDuplicates) {
      applyAdd(appState, newDupe);
    }
    for (const toDelete of dupeIdsToDelete) {
      applyDelete(appState, toDelete);
    }
  };
  const submitUpdate = (card: OriginalCard) => {
    const nextState = cloneDeep(appState);
    applyUpdate(nextState, card);
    setAppState(nextState);
  };

  const applyMove = (appState: AppState, move: CardMove) => {
    removeCardsEverywehre(appState, [move.id]);
    if (move.destination.type === 'deck') {
      appState.deck.splice(move.destination.position, 0, move.id);
    } else if (move.destination.type === 'hand') {
      appState.hands[move.destination.handIndex].splice(
        move.destination.position,
        0,
        move.id
      );
    }
  };
  const submitMove = (move: CardMove) => {
    const nextState = cloneDeep(appState);
    applyMove(nextState, move);
    setAppState(nextState);
  };

  const submitShuffle = () => {
    const nextState = cloneDeep(appState);
    nextState.deck = shuffle(nextState.deck);
    setAppState(nextState);
  };

  console.log('card ids', new Set(Object.keys(appState.cards)));
  console.log(
    'deck & card ids',
    new Set([...appState.deck, ...appState.hands.flatMap((h) => h)])
  );

  assert(
    isEqual(
      new Set(Object.keys(appState.cards)),
      new Set([...appState.deck, ...appState.hands.flatMap((h) => h)])
    )
  );

  return {
    appState,
    submitAdd,
    submitDelete,
    submitUpdate,
    submitMove,
    submitShuffle,
  };
};
