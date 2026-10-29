<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogScrollContent class="surface-card sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Runs</DialogTitle>
        <DialogDescription>Loot and stashes are kept per run. Maps follow the run's difficulty.</DialogDescription>
      </DialogHeader>

      <ul v-if="runs.length" class="space-y-1.5">
        <li v-for="run in runs" :key="run.id">
          <form
            v-if="editingRunId === run.id"
            class="space-y-3 rounded-lg border border-primary/50 bg-background/40 p-3"
            @submit.prevent="handleSaveEdit"
          >
            <div>
              <Label :for="`run-name-${run.id}`" class="hud-label text-muted-foreground">Name</Label>
              <Input :id="`run-name-${run.id}`" v-model="editName" class="mt-1 h-9" />
            </div>
            <DifficultyPicker v-model="editDifficulty" />
            <p class="text-xs text-muted-foreground">Changing difficulty switches the map artwork for this run.</p>
            <div class="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" @click="cancelEdit">Cancel</Button>
              <Button type="submit" size="sm" :disabled="!editName.trim() || !editDifficulty">Save</Button>
            </div>
          </form>

          <div
            v-else
            :class="cn(
              'flex items-center gap-1 rounded-lg border transition-colors',
              run.id === currentRun?.id ? 'border-primary/60 bg-accent' : 'border-border hover:bg-accent/60',
            )"
          >
            <button type="button" class="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left" :aria-current="run.id === currentRun?.id ? 'true' : undefined" @click="handleSelectRun(run.id)">
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ run.name }}</span>
                  <DifficultyChip :difficulty="run.difficulty" />
                </span>
                <span class="tabular mt-0.5 block text-xs text-muted-foreground">
                  {{ stats(run.id).remaining }} to loot · {{ stats(run.id).looted }} looted · started {{ formatDate(run.createdAt) }}
                </span>
              </span>
              <CheckIcon v-if="run.id === currentRun?.id" class="size-4 shrink-0 text-primary" aria-label="Current run" />
            </button>
            <Button size="icon" variant="ghost" class="size-9 shrink-0" :aria-label="`Edit ${run.name}`" @click="startEdit(run)">
              <PencilIcon class="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              class="size-9 shrink-0 text-muted-foreground hover:text-destructive"
              :aria-label="`Clear items in ${run.name}`"
              title="Clear items"
              :disabled="!stats(run.id).remaining && !stats(run.id).looted"
              @click="pendingClearRunId = run.id"
            >
              <EraserIcon class="size-4" />
            </Button>
            <Button size="icon" variant="ghost" class="mr-1 size-9 shrink-0 text-muted-foreground hover:text-destructive" :aria-label="`Delete ${run.name}`" @click="pendingDeleteRunId = run.id">
              <TrashIcon class="size-4" />
            </Button>
          </div>
        </li>
      </ul>
      <p v-else class="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No runs yet. Start one below to begin marking loot.
      </p>

      <form class="space-y-3 border-t border-border pt-4" @submit.prevent="handleCreateRun">
        <h3 class="hud-label text-muted-foreground">New run</h3>
        <Input v-model="newRunName" placeholder="e.g. Stalker, day 1" class="h-9" aria-label="New run name" />
        <DifficultyPicker v-model="selectedDifficulty" />
        <Button type="submit" class="w-full" :disabled="!newRunName.trim() || !selectedDifficulty">
          <PlusIcon class="size-4" /> Start run
        </Button>
      </form>
    </DialogScrollContent>
  </Dialog>

  <ConfirmDialog
    :open="!!pendingDeleteRunId"
    title="Delete this run?"
    description="Its loot markers and stashes go with it. Pinned places stay, they are shared by all runs."
    confirm-label="Delete run"
    @update:open="(v) => { if (!v) pendingDeleteRunId = null }"
    @confirm="confirmDeleteRun"
  />

  <ConfirmDialog
    :open="!!pendingClearRunId"
    title="Clear all items in this run?"
    description="Removes every loot and stash marker in the run, looted or not. The run itself and your pinned places stay."
    confirm-label="Clear items"
    @update:open="(v) => { if (!v) pendingClearRunId = null }"
    @confirm="confirmClearRun"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CheckIcon, EraserIcon, PencilIcon, PlusIcon, TrashIcon } from '@lucide/vue'
import { Dialog, DialogDescription, DialogHeader, DialogScrollContent, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import DifficultyPicker from '~/components/DifficultyPicker.vue'
import { useGameData } from '~/composables/useGameData'
import { forgetKeptGameEvents } from '~/composables/useLiveGame'
import DifficultyChip from '~/components/DifficultyChip.vue'
import { cn } from '~/lib/utils'
import type { Difficulty, Run } from '~/types'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { runs, currentRun, markers, addRun, deleteRun, clearRunItems, setCurrentRun, updateRun } = useGameData()

const newRunName = ref('')
const selectedDifficulty = ref<Difficulty | null>(null)
const pendingDeleteRunId = ref<string | null>(null)
const pendingClearRunId = ref<string | null>(null)
const editingRunId = ref<string | null>(null)
const editName = ref('')
const editDifficulty = ref<Difficulty | null>(null)

function stats(runId: string) {
  let remaining = 0
  let looted = 0
  for (const m of markers.value) {
    if (m.runId !== runId) continue
    if (m.lootedAt) looted++
    else remaining++
  }
  return { remaining, looted }
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function handleSelectRun(runId: string) {
  setCurrentRun(runId)
  emit('update:open', false)
}

function startEdit(run: Run) {
  editingRunId.value = run.id
  editName.value = run.name
  editDifficulty.value = run.difficulty
}

function cancelEdit() {
  editingRunId.value = null
}

function handleSaveEdit() {
  if (!editingRunId.value || !editName.value.trim() || !editDifficulty.value) return
  updateRun(editingRunId.value, { name: editName.value.trim(), difficulty: editDifficulty.value })
  cancelEdit()
}

function confirmDeleteRun() {
  if (pendingDeleteRunId.value) deleteRun(pendingDeleteRunId.value)
  pendingDeleteRunId.value = null
}

function confirmClearRun() {
  if (pendingClearRunId.value) {
    clearRunItems(pendingClearRunId.value)
    // Marks from the game still waiting for a calibrated map would come back otherwise
    forgetKeptGameEvents()
  }
  pendingClearRunId.value = null
}

function handleCreateRun() {
  if (!newRunName.value.trim() || !selectedDifficulty.value) return
  addRun(newRunName.value.trim(), selectedDifficulty.value)
  newRunName.value = ''
  selectedDifficulty.value = null
  emit('update:open', false)
}
</script>
