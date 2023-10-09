import assert from 'assert';
import {
  cloneDeep,
  isEqual,
  pickBy,
  shuffle,
  times,
  uniq,
  uniqBy,
} from 'lodash';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Card,
  CardMove,
  DuplicateCard,
  Hand,
  OriginalCard,
  StateUpdate,
  applyAdd,
  applyDelete,
  applyMove,
  applyStateUpdates,
  applyUpdate,
} from './appState';
import {
  GetStateRequestBody,
  GetStateResponseData,
} from '@/pages/api/getState';
import { v4 as uuid } from 'uuid';

let handler: NodeJS.Timeout | null = null;
const debounce =
  (fn: (...args: any[]) => void, delay: number) =>
  (...args: any[]) => {
    if (handler) {
      clearTimeout(handler);
    }
    handler = setTimeout(() => fn(...args), delay);
  };

export const useSyncedState = () => {
  const [appState_, setAppState] = useState<AppState>({
    cards: {},
    deck: [],
    hands: {},
  });

  const [stateUpdates, setStateUpdates] = useState<StateUpdate[]>([]);
  // wack ref because it doesn't work without
  const stateUpdatesRef = useRef(stateUpdates);
  stateUpdatesRef.current = stateUpdates;

  const appState = cloneDeep(appState_);
  applyStateUpdates(appState, stateUpdates);

  useEffect(() => {
    const syncState = async () => {
      const updatesSent = stateUpdatesRef.current.map((s) => s.id);
      console.log('sending updates: ', stateUpdatesRef.current);
      const body: GetStateRequestBody = { updates: stateUpdatesRef.current };
      const response = (await (
        await fetch('api/getState', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      ).json()) as GetStateResponseData;
      if (response.appState) {
        console.log('got state: ', response.appState);
        setStateUpdates((oldUpdates) =>
          oldUpdates.filter((u) => !updatesSent.includes(u.id))
        );
        setAppState(response.appState);
      }
    };

    syncState();
    const handler = setInterval(syncState, 3000);
    return () => clearTimeout(handler);
  }, []);

  const submitAdd = (card: Card) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'addCard', card },
    ]);
  };

  // TODO: should this be only to submit a delete update?
  const submitDelete = (id: string) => {
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

    // appState.cards = pickBy(appState.cards, (c) => !idsToDelete.includes(c.id));

    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      ...idsToDelete.map(
        (id) => ({ id: uuid(), type: 'deleteCard', cardId: id } as const)
      ),
    ]);
  };

  const submitUpdate = (card: OriginalCard) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'updateCard', card },
    ]);
  };

  // I think there's a bug here but it seems subtle
  const changeDuplication = (cardId: string, newDuplication: number) => {
    const currentDuplication = Object.values(appState.cards).filter(
      (c) =>
        c.id === cardId || (c.type === 'duplicate' && c.parentId === cardId)
    ).length;

    if (newDuplication > currentDuplication) {
      const newDupes: DuplicateCard[] = [];
      for (let i = 0; i < newDuplication - currentDuplication; i++) {
        newDupes.push({
          type: 'duplicate',
          id: uuid(),
          parentId: cardId,
        } as const);
      }
      newDupes.forEach((d) => submitAdd(d));
    } else if (newDuplication < currentDuplication) {
      const dupeIds = Object.values(appState.cards)
        .filter((c) => c.type === 'duplicate' && c.parentId === cardId)
        .map((c) => c.id);
      const dupeIdsToDelete = dupeIds.slice(
        0,
        currentDuplication - newDuplication
      );
      setStateUpdates((oldUpdates) => [
        ...oldUpdates,
        ...dupeIdsToDelete.map(
          (id) => ({ id: uuid(), type: 'deleteCard', cardId: id } as const)
        ),
      ]);
    }
  };

  const submitMove = (move: CardMove) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'moveCard', move },
    ]);
  };

  const submitShuffle = () => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      {
        id: uuid(),
        type: 'reorder',
        reorder: { type: 'deck', order: shuffle(appState.deck) },
      },
    ]);
  };

  const submitUpsertHand = (hand: Omit<Hand, 'contents'>) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      {
        id: uuid(),
        type: 'upsertHand',
        hand,
      },
    ]);
  };

  const submitRemoveHand = (handId: string) => {
    appState.hands[handId].contents.forEach((id) =>
      submitMove({ id, destination: { type: 'deck', position: 0 } })
    );

    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      {
        id: uuid(),
        type: 'deleteHand',
        handId,
      },
    ]);
  };

  // console.log('card ids', new Set(Object.keys(appState.cards)));
  // console.log(
  //   'deck & card ids',
  //   new Set([...appState.deck, ...appState.hands.flatMap((h) => h)])
  // );

  assert(
    isEqual(
      new Set(Object.keys(appState.cards)),
      new Set([
        ...appState.deck,
        ...Object.values(appState.hands)
          .map((h) => h.contents)
          .flatMap((c) => c),
      ])
    )
  );

  return {
    appState,
    submitAdd,
    submitDelete,
    submitUpdate,
    changeDuplication,
    submitMove,
    submitShuffle,
    submitUpsertHand,
    submitRemoveHand,
  };
};
