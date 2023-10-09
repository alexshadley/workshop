import { pickBy } from 'lodash';
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

export type StateUpdate =
  | {
      id: string;
      type: 'addCard';
      card: Card;
    }
  | {
      id: string;
      type: 'deleteCard';
      cardId: string;
    }
  | {
      id: string;
      type: 'updateCard';
      card: Card;
    }
  | {
      id: string;
      type: 'moveCard';
      move: CardMove;
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

export const INITIAL_STATE: AppState = { cards: {}, deck: [], hands: [[]] };

export const applyStateUpdates = (
  appState: AppState,
  updates: StateUpdate[]
) => {
  for (const u of updates) {
    if (u.type === 'addCard') {
      applyAdd(appState, u.card);
    } else if (u.type === 'deleteCard') {
      applyDelete(appState, u.cardId);
    } else if (u.type === 'updateCard') {
      applyUpdate(appState, u.card);
    } else if (u.type === 'moveCard') {
      applyMove(appState, u.move);
    }
  }
};

const removeCardsEverywehre = (appState: AppState, ids: string[]) => {
  appState.deck = appState.deck.filter((id) => !ids.includes(id));
  appState.hands = appState.hands.map((h) => {
    return [...h].filter((id) => !ids.includes(id));
  });
};

export const applyAdd = (appState: AppState, card: Card) => {
  appState.cards[card.id] = card;
  appState.deck = [card.id, ...appState.deck];
};

export const applyDelete = (appState: AppState, id: string) => {
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

export const applyUpdate = (appState: AppState, card: OriginalCard) => {
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

export const applyMove = (appState: AppState, move: CardMove) => {
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
