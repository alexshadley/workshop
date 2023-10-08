'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ArrowUpOnSquareIcon,
} from '@heroicons/react/24/outline';
import { v4 as uuid } from 'uuid';
import { shuffle, pickBy, isEqual, clone, cloneDeep } from 'lodash';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import dragHandle from '../public/drag-handle.svg';
import Image from 'next/image';

type OriginalCard = {
  type: 'original';
  id: string;
  name: string;
  description: string;
  duplication: number;
};

type DuplicateCard = { type: 'duplicate'; id: string; parentId: string };

type Card = OriginalCard | DuplicateCard;

let handler = null;
const debounce =
  (fn, delay) =>
  (...args) => {
    if (handler) {
      clearTimeout(handler);
    }
    handler = setTimeout(() => fn(...args), delay);
  };

export const Cards = () => {
  // registry of all cards
  const firstCardId = uuid();
  const [cards, setCards] = useState<{ [id: string]: Card }>({
    [firstCardId]: {
      type: 'original',
      id: firstCardId,
      name: '',
      description: '',
      duplication: 1,
    },
  });
  // ordering of cards in deck
  const [deck, setDeck] = useState<string[]>([firstCardId]);
  const [hands, setHands] = useState<string[][]>([[]]);

  const unputChanges = useRef(false);
  const firstFetchDone = useRef(false);

  const fetchLatestData = async () => {
    const data = (await (await fetch('api/getData')).json())['data'];
    setCards(data.cards);
    setDeck(data.deck);
    setHands(data.hands);
    console.log('data', data);
    firstFetchDone.current = true;
  };

  const putData = debounce(async (data: any) => {
    console.log('putting', data);
    await fetch('api/putData', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    unputChanges.current = false;
  }, 2000);

  useEffect(() => {
    const work = async () => {
      console.log('unput changes?', unputChanges.current);
      if (!unputChanges.current) {
        await fetchLatestData();
      }
    };

    const handler = setInterval(work, 5000);
    fetchLatestData();
    return () => clearTimeout(handler);
  }, []);

  const lastPut = useRef(null);
  useEffect(() => {
    if (
      !isEqual(lastPut.current, { cards, deck, hands }) &&
      firstFetchDone.current
    ) {
      unputChanges.current = true;
      lastPut.current = { cards, deck, hands };
      putData({ cards, deck, hands });
    }
  }, [cards, deck, hands]);

  const shuffleDeck = () => {
    setDeck((oldDeck) => shuffle(oldDeck));
  };

  const newCard = () => {
    const n = {
      type: 'original',
      id: uuid(),
      name: '',
      description: '',
      duplication: 1,
    } as const;
    setCards((oldCards) => ({
      [n.id]: n,
      ...oldCards,
    }));
    setDeck((oldDeck) => [n.id, ...oldDeck]);
  };

  const removeCardsEverywehre = (ids: string[]) => {
    setDeck((oldDeck) => {
      return [...oldDeck].filter((id) => !ids.includes(id));
    });
    setHands((oldHands) => {
      console.log('removing from', oldHands);
      return oldHands.map((h) => {
        return [...h].filter((id) => !ids.includes(id));
      });
    });
  };

  const addCardsToHand = (cardIds: string[], handIndex: number) => {
    setHands((oldHands) => {
      console.log('adding to', oldHands);
      return oldHands.map<string[]>((h, i) => {
        if (i === handIndex) {
          return [...cardIds, ...h];
        } else {
          return [...h];
        }
      });
    });
  };

  const updateCard = (card: OriginalCard) => {
    const originalCard = cards[card.id] as OriginalCard;

    let duplicationChange = card.duplication - originalCard.duplication;

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
      const dupeIds = Object.values(cards)
        .filter((c) => c.type === 'duplicate' && c.parentId === originalCard.id)
        .map((c) => c.id);
      console.log('dupeIds', dupeIds);
      console.log('duplication change', duplicationChange);
      dupeIdsToDelete = dupeIds.slice(0, duplicationChange * -1);
      console.log('dupeIdsToDelete', dupeIds);
    }

    setCards((oldCards) => {
      const newCards = { ...oldCards };
      newDuplicates.forEach((d) => (newCards[d.id] = d));
      dupeIdsToDelete.forEach((id) => delete newCards[id]);

      return { ...newCards, [card.id]: card };
    });
    setDeck((oldDeck) => {
      let newDeck = [...oldDeck];
      const originalPosition = oldDeck.indexOf(originalCard.id);
      newDuplicates.forEach((d) => newDeck.splice(originalPosition, 0, d.id));

      return newDeck;
    });
    removeCardsEverywehre(dupeIdsToDelete);
  };

  const deleteCard = (id: string) => {
    const originalCard = cards[id] as OriginalCard;

    const idsToDelete = Object.values(cards)
      .filter(
        (c) =>
          (c.type === 'original' && c.id === originalCard.id) ||
          (c.type === 'duplicate' && c.parentId === originalCard.id)
      )
      .map((c) => c.id);

    console.log('idsToDelete', idsToDelete);
    setCards((oldCards) =>
      pickBy(oldCards, (c) => !idsToDelete.includes(c.id))
    );
    removeCardsEverywehre(idsToDelete);
  };

  const drawTopCard = (handIndex: number) => {
    if (deck.length === 0) {
      return;
    }
    const cardId = deck[0];
    setDeck(deck.slice(1));
    addCardsToHand([cardId], handIndex);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) {
      return;
    }

    const dropData: any = event.over.data.current;
    const cardId: string = event.active.id as string;

    removeCardsEverywehre([cardId]);

    if (dropData.type === 'hand') {
      addCardsToHand([cardId], dropData.handIndex);
    } else if (dropData.type === 'deck') {
      setDeck((oldDeck) => [cardId, ...oldDeck]);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div>
        {hands.map((h, i) => (
          <div className="mb-10" key={i}>
            <Hand
              handIndex={i}
              cards={cards}
              onUpdateCard={updateCard}
              handCards={h}
              onDrawTopCard={() => drawTopCard(i)}
            />
          </div>
        ))}
        <Deck
          cards={cards}
          deck={deck}
          onShuffleDeck={shuffleDeck}
          onNewCard={newCard}
          onUpdateCard={updateCard}
          onDeleteCard={deleteCard}
        />
      </div>
    </DndContext>
  );
};

const Deck = ({
  cards,
  deck,
  onShuffleDeck,
  onNewCard,
  onUpdateCard,
  onDeleteCard,
}: {
  cards: { [id: string]: Card };
  deck: string[];
  onShuffleDeck: () => void;
  onNewCard: () => void;
  onUpdateCard: (n: OriginalCard) => void;
  onDeleteCard: (id: string) => void;
}) => {
  const [name, setName] = useState('Deck');

  const [showAll, setShowAll] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);

  const { isOver, setNodeRef } = useDroppable({
    id: 'deck',
    data: {
      type: 'deck',
    },
  });

  return (
    <div>
      <div style={{ width: '600px' }} ref={setNodeRef}>
        <div className="flex justify-between mb-4">
          <EditableText value={name} onChange={setName} classes="text-xl" />
          <div className="flex gap-2">
            <TrashIcon
              className="w-6 h-6 cursor-pointer"
              onClick={() => setDeleteMode(!deleteMode)}
            />
            {showAll ? (
              <EyeSlashIcon
                className="w-6 h-6 cursor-pointer"
                onClick={() => setShowAll(false)}
              />
            ) : (
              <EyeIcon
                className="w-6 h-6 cursor-pointer"
                onClick={() => setShowAll(true)}
              />
            )}
            <ArrowPathIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onShuffleDeck}
            />
            <PlusIcon className="w-6 h-6 cursor-pointer" onClick={onNewCard} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {deck.map((id) => {
            let originalCard: OriginalCard;
            const card = cards[id];
            if (card.type === 'original') {
              originalCard = card;
            } else {
              originalCard = cards[card.parentId] as OriginalCard;
            }

            return (
              <CardTile
                id={id}
                shown={showAll}
                deleteMode={deleteMode}
                key={id}
                originalCard={originalCard}
                onUpdate={onUpdateCard}
                onDelete={() => onDeleteCard(originalCard.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CardTile = ({
  id,
  originalCard,
  shown = true,
  deleteMode,
  onUpdate,
  onDelete,
}: {
  id: string;
  originalCard: OriginalCard;
  shown?: boolean;
  deleteMode?: boolean;
  onUpdate: (newCard: OriginalCard) => void;
  onDelete?: () => void;
}) => {
  const [individuallyShown, setIndividuallyShown] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      className="flex p-2 border rounded border-gray-300 bg-gray-100 h-10"
      style={style}
    >
      <Image
        src={dragHandle}
        alt="drag handle"
        width={24}
        height={24}
        ref={setNodeRef}
        {...listeners}
        {...attributes}
      />
      <div className="w-11/12">
        {(shown || individuallyShown) && (
          <>
            <EditableText
              placeholder="Name"
              value={originalCard.name}
              onChange={(newVal) => onUpdate({ ...originalCard, name: newVal })}
              classes="w-1/4"
            />
            <EditableText
              placeholder="Description"
              value={originalCard.description}
              onChange={(newVal) =>
                onUpdate({ ...originalCard, description: newVal })
              }
              classes="w-3/4"
            />
          </>
        )}
      </div>
      <div className="flex justify-end w-1/12">
        {!shown && individuallyShown && (
          <EyeSlashIcon
            className="w-6 h-6 cursor-pointer"
            onClick={() => setIndividuallyShown(false)}
          />
        )}
        {!shown && !individuallyShown && (
          <EyeIcon
            className="w-6 h-6 cursor-pointer"
            onClick={() => setIndividuallyShown(true)}
          />
        )}
        {deleteMode && (
          <TrashIcon className="w-6 h-6 cursor-pointer" onClick={onDelete} />
        )}
        {!deleteMode && shown && (
          <EditableNumber
            classes="w-6"
            value={originalCard.duplication}
            onChange={(newVal) =>
              onUpdate({ ...originalCard, duplication: newVal })
            }
          />
        )}
      </div>
    </div>
  );
};

const EditableNumber = ({
  placeholder,
  value,
  onChange,
  classes,
}: {
  placeholder?: string;
  value: number;
  onChange: (n: number) => void;
  classes?: string;
}) => {
  const [localValue, setLocalValue] = useState<string | null>(null);

  return (
    <input
      placeholder={placeholder}
      className={`bg-transparent outline-none ${classes}`}
      value={localValue ?? value}
      onChange={(e) => {
        setLocalValue(e.target.value);
      }}
      onBlur={() => {
        if (localValue && !Number.isNaN(parseInt(localValue))) {
          onChange(parseInt(localValue));
        }
        setLocalValue(null);
      }}
    />
  );
};

const EditableText = ({
  placeholder,
  value,
  onChange,
  classes,
}: {
  placeholder?: string;
  value: string;
  onChange: (n: string) => void;
  classes?: string;
}) => {
  return (
    <input
      placeholder={placeholder}
      className={`bg-transparent outline-none ${classes}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const Hand = ({
  handIndex,
  cards,
  onUpdateCard,
  handCards,
  onDrawTopCard,
}: {
  handIndex: number;
  cards: { [id: string]: Card };
  onUpdateCard: (updatedCard: OriginalCard) => void;
  handCards: string[];
  onDrawTopCard: () => void;
}) => {
  const [name, setName] = useState('Hand');

  const { isOver, setNodeRef } = useDroppable({
    id: `hand-${handIndex}`,
    data: {
      type: 'hand',
      handIndex,
    },
  });

  return (
    <div ref={setNodeRef}>
      <div style={{ width: '600px' }}>
        <div className="flex justify-between mb-4">
          <EditableText value={name} onChange={setName} classes="text-xl" />
          <div className="flex gap-2">
            <ArrowUpOnSquareIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onDrawTopCard}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {handCards.map((id) => {
            let originalCard: OriginalCard;
            const card = cards[id];
            if (card.type === 'original') {
              originalCard = card;
            } else {
              originalCard = cards[card.parentId] as OriginalCard;
            }

            return (
              <CardTile
                id={id}
                key={id}
                originalCard={originalCard}
                onUpdate={(c) => onUpdateCard(c)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
