import assert from 'assert';
import { cloneDeep, isEqual, pickBy, shuffle, uniq, uniqBy } from 'lodash';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Card,
  CardMove,
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
    hands: [[]],
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
      const body: GetStateRequestBody = { updates: stateUpdatesRef.current };
      const response = (await (
        await fetch('api/getState', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      ).json()) as GetStateResponseData;
    };
    // if (!initialized.current) {
    //   const storedState = window.localStorage.getItem('appState');
    //   console.log('storedState', storedState);
    //   if (storedState) {
    //     setAppState(JSON.parse(storedState));
    //   }
    //   initialized.current = true;

    //   fetch('api/putData', { method: 'POST', body: storedState });
    // }
  }, []);

  // useEffect(() => {
  //   if (initialized) {
  //     window.localStorage.setItem('appState', JSON.stringify(appState));
  //   }
  // }, [appState]);

  const submitAdd = (card: Card) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'addCard', card },
    ]);
  };

  const submitDelete = (id: string) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'deleteCard', cardId: id },
    ]);
  };

  const submitUpdate = (card: OriginalCard) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'updateCard', card },
    ]);
  };

  const submitMove = (move: CardMove) => {
    setStateUpdates((oldUpdates) => [
      ...oldUpdates,
      { id: uuid(), type: 'moveCard', move },
    ]);
  };

  const submitShuffle = () => {
    // TODO
    // const nextState = cloneDeep(appState);
    // nextState.deck = shuffle(nextState.deck);
    // setAppState(nextState);
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
