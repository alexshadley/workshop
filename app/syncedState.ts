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

export const useSyncedState = () => {
  const [appState, setAppState] = useState<AppState>({
    cards: {},
    deck: [],
    hands: [[]],
  });

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      const storedState = window.localStorage.getItem('appState');
      console.log('storedState', storedState);
      if (storedState) {
        setAppState(JSON.parse(storedState));
      }
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      window.localStorage.setItem('appState', JSON.stringify(appState));
    }
  }, [appState]);

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

    appState.cards = pickBy(
      appState.cards,
      (c) => !dupeIdsToDelete.includes(c.id)
    );
    removeCardsEverywehre(appState, dupeIdsToDelete);

    appState.cards[card.id] = card;
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

  const submitAddHand = () => {
    const nextState = cloneDeep(appState);
    nextState.hands = [...nextState.hands, []];
    setAppState(nextState);
  };
  const submitRemoveHand = (handIndex: number) => {
    const nextState = cloneDeep(appState);
    nextState.hands = nextState.hands.splice(handIndex, 1);
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
    submitAddHand,
    submitRemoveHand,
  };
};
