import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { detectConflicts } from "@/engine/conflict-detector";
import type { SlotData, TeacherConstraintData, Conflict } from "@/engine/conflict-detector";

export interface TimetableSlot extends SlotData {
  id?: string;
  subjectName: string;
  subjectColor: string;
  teacherName: string;
  className: string;
  roomName?: string;
}

export interface TimetableState {
  slots: TimetableSlot[];
  pendingConflicts: Record<string, Conflict[]>; // key = slotKey
  teacherConstraints: TeacherConstraintData[];
  isDirty: boolean;
  history: TimetableSlot[][];
  historyIndex: number;

  // Actions
  setSlots: (slots: TimetableSlot[]) => void;
  setConstraints: (constraints: TeacherConstraintData[]) => void;
  addSlot: (slot: TimetableSlot) => Conflict[];
  updateSlot: (id: string, updates: Partial<TimetableSlot>) => Conflict[];
  removeSlot: (day: number, period: number, classId: string) => void;
  moveSlot: (
    fromDay: number,
    fromPeriod: number,
    fromClassId: string,
    toDay: number,
    toPeriod: number,
    toClassId: string
  ) => Conflict[];
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}

const MAX_HISTORY = 50;

export const useTimetableStore = create<TimetableState>()(
  immer((set, get) => ({
    slots: [],
    pendingConflicts: {},
    teacherConstraints: [],
    isDirty: false,
    history: [],
    historyIndex: -1,

    setSlots: (slots) => {
      set((state) => {
        state.slots = slots;
        state.isDirty = false;
        state.history = [slots];
        state.historyIndex = 0;
        state.pendingConflicts = {};
      });
    },

    setConstraints: (constraints) => {
      set((state) => {
        state.teacherConstraints = constraints;
      });
    },

    addSlot: (slot) => {
      const conflicts = detectConflicts(slot, get().slots, get().teacherConstraints);

      set((state) => {
        // Remove any existing slot in the same position
        state.slots = state.slots.filter(
          (s) => !(s.day === slot.day && s.period === slot.period && s.classId === slot.classId)
        );
        state.slots.push(slot);

        const key = `${slot.day}-${slot.period}-${slot.classId}`;
        if (conflicts.length > 0) {
          state.pendingConflicts[key] = conflicts;
        } else {
          delete state.pendingConflicts[key];
        }

        // Push to history
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push([...state.slots]);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        state.history = newHistory;
        state.historyIndex = newHistory.length - 1;
        state.isDirty = true;
      });

      return conflicts;
    },

    updateSlot: (id, updates) => {
      const existing = get().slots.find((s) => s.id === id);
      if (!existing) return [];
      const updated = { ...existing, ...updates };
      const conflicts = detectConflicts(
        updated,
        get().slots,
        get().teacherConstraints
      );

      set((state) => {
        const idx = state.slots.findIndex((s) => s.id === id);
        if (idx >= 0) state.slots[idx] = updated;
        state.isDirty = true;
      });

      return conflicts;
    },

    removeSlot: (day, period, classId) => {
      set((state) => {
        state.slots = state.slots.filter(
          (s) => !(s.day === day && s.period === period && s.classId === classId)
        );
        const key = `${day}-${period}-${classId}`;
        delete state.pendingConflicts[key];

        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push([...state.slots]);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        state.history = newHistory;
        state.historyIndex = newHistory.length - 1;
        state.isDirty = true;
      });
    },

    moveSlot: (fromDay, fromPeriod, fromClassId, toDay, toPeriod, toClassId) => {
      const moving = get().slots.find(
        (s) => s.day === fromDay && s.period === fromPeriod && s.classId === fromClassId
      );
      if (!moving) return [];

      const proposed = { ...moving, day: toDay, period: toPeriod, classId: toClassId };
      // Exclude the moving slot from conflict check
      const otherSlots = get().slots.filter(
        (s) => !(s.day === fromDay && s.period === fromPeriod && s.classId === fromClassId)
      );
      const conflicts = detectConflicts(proposed, otherSlots, get().teacherConstraints);

      set((state) => {
        state.slots = state.slots.filter(
          (s) => !(s.day === fromDay && s.period === fromPeriod && s.classId === fromClassId)
        );
        // Remove destination if occupied
        state.slots = state.slots.filter(
          (s) => !(s.day === toDay && s.period === toPeriod && s.classId === toClassId)
        );
        state.slots.push(proposed);

        const key = `${toDay}-${toPeriod}-${toClassId}`;
        const oldKey = `${fromDay}-${fromPeriod}-${fromClassId}`;
        delete state.pendingConflicts[oldKey];
        if (conflicts.length > 0) {
          state.pendingConflicts[key] = conflicts;
        } else {
          delete state.pendingConflicts[key];
        }

        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push([...state.slots]);
        if (newHistory.length > MAX_HISTORY) newHistory.shift();
        state.history = newHistory;
        state.historyIndex = newHistory.length - 1;
        state.isDirty = true;
      });

      return conflicts;
    },

    undo: () => {
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex--;
          state.slots = state.history[state.historyIndex];
          state.isDirty = true;
        }
      });
    },

    redo: () => {
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++;
          state.slots = state.history[state.historyIndex];
          state.isDirty = true;
        }
      });
    },

    markSaved: () => {
      set((state) => {
        state.isDirty = false;
      });
    },
  }))
);
