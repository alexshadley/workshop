import { orderBy, pickBy, sortBy } from 'lodash';
import { v4 as uuid } from 'uuid';

export type OriginalCard = {
  type: 'original';
  id: string;
  name: string;
  description: string;
};

export type DuplicateCard = { type: 'duplicate'; id: string; parentId: string };

export type Card = OriginalCard | DuplicateCard;

export type CardIndex = { [id: string]: Card };

export type Hand = {
  id: string;
  name: string;
  contents: string[];
};

export type AppState = {
  cards: { [id: string]: Card };
  deck: string[];
  hands: { [id: string]: Hand };
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
    }
  | {
      id: string;
      type: 'reorder';
      reorder: Reorder;
    }
  | {
      id: string;
      type: 'upsertHand';
      hand: Omit<Hand, 'contents'>;
    }
  | {
      id: string;
      type: 'deleteHand';
      handId: string;
    };

export type CardMove = {
  id: string;
  destination:
    | {
        type: 'deck';
        position: number;
      }
    | { type: 'hand'; handId: string; position: number };
};

export type Reorder =
  | {
      type: 'hand';
      handId: string;
      order: string[];
    }
  | {
      type: 'deck';
      order: string[];
    };

const firstHandId = uuid();
export const INITIAL_STATE: AppState = {
  cards: {},
  deck: [],
  hands: { [firstHandId]: { id: firstHandId, name: 'Hand', contents: [] } },
};

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
    } else if (u.type === 'reorder') {
      applyReorder(appState, u.reorder);
    } else if (u.type === 'upsertHand') {
      applyUpsertHand(appState, u.hand);
    } else if (u.type === 'deleteHand') {
      applyDeleteHand(appState, u.handId);
    }
  }
};

const removeCardsEverywehre = (appState: AppState, ids: string[]) => {
  appState.deck = appState.deck.filter((id) => !ids.includes(id));
  Object.values(appState.hands).forEach((h) => {
    h.contents = h.contents.filter((id) => !ids.includes(id));
  });
};

export const applyAdd = (appState: AppState, card: Card) => {
  appState.cards[card.id] = card;
  appState.deck = [card.id, ...appState.deck];
};

export const applyDelete = (appState: AppState, id: string) => {
  appState.cards = pickBy(appState.cards, (c) => id !== c.id);
  removeCardsEverywehre(appState, [id]);
};

export const applyUpdate = (appState: AppState, card: Card) => {
  appState.cards[card.id] = card;
};

export const applyMove = (appState: AppState, move: CardMove) => {
  removeCardsEverywehre(appState, [move.id]);
  if (move.destination.type === 'deck') {
    appState.deck.splice(move.destination.position, 0, move.id);
  } else if (move.destination.type === 'hand') {
    appState.hands[move.destination.handId].contents.splice(
      move.destination.position,
      0,
      move.id
    );
  }
};

export const applyReorder = (appState: AppState, reorder: Reorder) => {
  if (reorder.type === 'deck') {
    appState.deck = sortBy(appState.deck, (id) => reorder.order.indexOf(id));
  } else {
    throw new Error('not implemented');
  }
};

export const applyUpsertHand = (
  appState: AppState,
  hand: Omit<Hand, 'contents'>
) => {
  appState.hands[hand.id] = {
    ...hand,
    contents: appState.hands[hand.id]?.contents ?? [],
  };
};

export const applyDeleteHand = (appState: AppState, handId: string) => {
  delete appState.hands[handId];
};
