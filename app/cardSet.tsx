'use client';

import { useState } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ArrowUpOnSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import dragHandle from '../public/drag-handle.svg';
import Image from 'next/image';
import { useSyncedState } from './syncedState';
import { v4 as uuid } from 'uuid';
import { CardIndex, Hand, OriginalCard } from './appState';

export const CardSet = ({ id, active }: { id: string; active: boolean }) => {
  const {
    appState: { cards, deck, hands, name },
    submitAdd,
    submitDelete,
    submitUpdate,
    changeDuplication,
    submitMove,
    submitShuffle,
    submitUpsertHand,
    submitRemoveHand,
    submitRenameCardSet,
  } = useSyncedState(id, active);

  const duplicationByCard: { [cardId: string]: number } = {};
  for (const card of Object.values(cards)) {
    if (card.type !== 'original') {
      continue;
    }

    const duplication =
      Object.values(cards).filter(
        (c) => c.type === 'duplicate' && c.parentId === card.id
      ).length + 1;
    duplicationByCard[card.id] = duplication;
  }

  const drawTopCard = (handId: string) => {
    if (deck.length > 0) {
      submitMove({
        id: deck[0],
        destination: { type: 'hand', handId, position: 0 },
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) {
      return;
    }

    const dropData: any = event.over.data.current;
    const cardId: string = event.active.id as string;

    let destination;
    if (dropData.type === 'deck') {
      destination = { type: 'deck', position: 0 } as const;
    } else {
      destination = {
        type: 'hand',
        handId: dropData.handId,
        position: 0,
      } as const;
    }
    submitMove({ id: cardId, destination });
  };

  return active ? (
    <DndContext onDragEnd={handleDragEnd}>
      <div>
        <button
          onClick={() => submitUpsertHand({ id: uuid(), name: 'Hand' })}
          className="border border-gray-400 bg-gray-100 rounded p-1 hover:shadow mb-4"
        >
          Add hand
        </button>
        {Object.values(hands).map((h) => (
          <div className="mb-10" key={h.id}>
            <HandView
              hand={h}
              cards={cards}
              duplicationByCard={duplicationByCard}
              onChangeDuplication={changeDuplication}
              onUpdateCard={submitUpdate}
              onDrawTopCard={() => drawTopCard(h.id)}
              onDeleteHand={() => submitRemoveHand(h.id)}
              onUpdateHand={(h) => submitUpsertHand(h)}
            />
          </div>
        ))}
        <Deck
          cards={cards}
          duplicationByCard={duplicationByCard}
          onChangeDuplication={changeDuplication}
          deck={deck}
          deckName={name}
          onShuffleDeck={submitShuffle}
          onNewCard={() => {
            submitAdd({
              type: 'original',
              id: uuid(),
              name: '',
              description: '',
            });
          }}
          onUpdateCard={submitUpdate}
          onDeleteCard={submitDelete}
          onChangeDeckName={submitRenameCardSet}
        />
      </div>
    </DndContext>
  ) : (
    <></>
  );
};

const Deck = ({
  cards,
  duplicationByCard,
  onChangeDuplication,
  deck,
  deckName,
  onShuffleDeck,
  onNewCard,
  onUpdateCard,
  onDeleteCard,
  onChangeDeckName,
}: {
  cards: CardIndex;
  duplicationByCard: { [cardId: string]: number };
  onChangeDuplication: (cardId: string, newDuplication: number) => void;
  deck: string[];
  deckName: string;
  onShuffleDeck: () => void;
  onNewCard: () => void;
  onUpdateCard: (n: OriginalCard) => void;
  onDeleteCard: (id: string) => void;
  onChangeDeckName: (newName: string) => void;
}) => {
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
          <EditableText
            value={deckName}
            onChange={onChangeDeckName}
            classes="text-xl"
          />
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
                duplication={duplicationByCard[originalCard.id]}
                onChangeDuplication={(n) => onChangeDuplication(id, n)}
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
  duplication,
  shown = true,
  deleteMode,
  onUpdate,
  onChangeDuplication,
  onDelete,
}: {
  id: string;
  originalCard: OriginalCard;
  duplication: number;
  shown?: boolean;
  deleteMode?: boolean;
  onUpdate: (newCard: OriginalCard) => void;
  onChangeDuplication: (newDuplication: number) => void;
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
      className="flex p-2 border rounded border-gray-300 bg-gray-100 h-10 group"
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
          <>
            <XMarkIcon
              className={
                'w-3 h-3' +
                (duplication === 1
                  ? ' invisible group-hover:visible focus:visible'
                  : '')
              }
              style={{ marginTop: '5px', marginRight: '3px' }}
            />
            <EditableNumber
              classes={
                'w-6' +
                (duplication === 1
                  ? ' invisible group-hover:visible focus:visible'
                  : '')
              }
              value={duplication}
              onChange={(newVal) => onChangeDuplication(newVal)}
            />
          </>
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

const HandView = ({
  hand,
  cards,
  duplicationByCard,
  onChangeDuplication,
  onUpdateCard,
  onDrawTopCard,
  onDeleteHand,
  onUpdateHand,
}: {
  hand: Hand;
  cards: CardIndex;
  onUpdateCard: (updatedCard: OriginalCard) => void;
  duplicationByCard: { [cardId: string]: number };
  onChangeDuplication: (cardId: string, newDuplication: number) => void;
  onDrawTopCard: () => void;
  onDeleteHand: () => void;
  onUpdateHand: (newHand: Omit<Hand, 'contents'>) => void;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `hand-${hand.id}`,
    data: {
      type: 'hand',
      handId: hand.id,
    },
  });

  return (
    <div ref={setNodeRef}>
      <div style={{ width: '600px' }}>
        <div className="flex justify-between mb-4">
          <EditableText
            value={hand.name}
            onChange={(n) => onUpdateHand({ id: hand.id, name: n })}
            classes="text-xl"
          />
          <div className="flex gap-2">
            <XMarkIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onDeleteHand}
            />
            <ArrowUpOnSquareIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onDrawTopCard}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {hand.contents.map((id) => {
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
                duplication={duplicationByCard[originalCard.id]}
                onChangeDuplication={(n) => onChangeDuplication(id, n)}
                onUpdate={(c) => onUpdateCard(c)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
