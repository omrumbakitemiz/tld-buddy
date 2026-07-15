<template>
  <Dialog :open="open" @update:open="(val) => $emit('update:open', val)">
    <DialogScrollContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>Your Runs</DialogTitle>
        <DialogDescription>
          Select or create a run to track your playthrough
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Existing runs list -->
        <div v-if="runs.length > 0" class="space-y-2">
          <template v-for="run in runs" :key="run.id">
            <!-- Edit mode -->
            <div
              v-if="editingRunId === run.id"
              class="rounded-lg border-2 border-primary/60 bg-card p-3 space-y-3"
            >
              <div class="space-y-1.5">
                <Label class="text-xs">Run Name</Label>
                <Input
                  v-model="editName"
                  placeholder="Run name"
                  class="h-8 text-sm"
                  @keydown.enter="handleSaveEdit"
                />
              </div>

              <div class="space-y-1.5">
                <Label class="text-xs">Difficulty</Label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="diff in difficulties"
                    :key="diff"
                    @click="editDifficulty = diff"
                    :class="cn(
                      'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer capitalize',
                      editDifficulty === diff
                        ? getDifficultyClasses(diff)
                        : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                    )"
                  >
                    {{ diff }}
                  </button>
                </div>
                <p class="text-[11px] text-muted-foreground/70">
                  Changing difficulty switches this run's map artwork.
                </p>
              </div>

              <div class="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" class="h-7 text-xs" @click="cancelEdit">Cancel</Button>
                <Button
                  size="sm"
                  class="h-7 text-xs"
                  :disabled="!editName.trim() || !editDifficulty"
                  @click="handleSaveEdit"
                >
                  Save
                </Button>
              </div>
            </div>

            <!-- Display mode -->
            <div
              v-else
              @click="handleSelectRun(run.id)"
              :class="cn(
                'group flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                run.id === currentRun?.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/40 bg-card'
              )"
            >
              <div class="flex items-center justify-center h-10 w-10 rounded-lg bg-muted/50 shrink-0">
                <SwordsIcon class="h-5 w-5 text-muted-foreground" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-semibold truncate">{{ run.name }}</p>
                  <Badge :variant="getDifficultyVariant(run.difficulty)" class="text-[10px] px-1.5 py-0 h-4 shrink-0">
                    {{ run.difficulty }}
                  </Badge>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs text-muted-foreground">
                    {{ getRunMarkerCount(run.id) }} markers
                  </span>
                  <span class="text-xs text-muted-foreground/50">&middot;</span>
                  <span class="text-xs text-muted-foreground">
                    {{ formatDate(run.createdAt) }}
                  </span>
                </div>
              </div>

              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                  @click.stop="startEdit(run)"
                >
                  <PencilIcon class="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  @click.stop="handleDeleteRun(run.id)"
                >
                  <TrashIcon class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </template>
        </div>

        <!-- Empty state -->
        <div v-else class="text-center py-8 text-muted-foreground">
          <SwordsIcon class="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p class="text-sm font-medium">No runs yet</p>
          <p class="text-xs mt-1">Create a run to start tracking your playthrough</p>
        </div>

        <Separator />

        <!-- Create new run form -->
        <div class="space-y-3">
          <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Create New Run</p>

          <div class="space-y-1.5">
            <Label for="run-name" class="text-sm">Run Name</Label>
            <Input
              id="run-name"
              v-model="newRunName"
              placeholder="e.g. Stalker Run #1"
              class="h-9 text-sm"
            />
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm">Difficulty</Label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="diff in difficulties"
                :key="diff"
                @click="selectedDifficulty = diff"
                :class="cn(
                  'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer capitalize',
                  selectedDifficulty === diff
                    ? getDifficultyClasses(diff)
                    : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                )"
              >
                {{ diff }}
              </button>
            </div>
          </div>

          <Button
            class="w-full h-9 text-sm"
            :disabled="!newRunName.trim() || !selectedDifficulty"
            @click="handleCreateRun"
          >
            <PlusIcon class="h-3.5 w-3.5 mr-1.5" />
            Create Run
          </Button>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>

  <ConfirmDialog
    :open="!!pendingDeleteRunId"
    title="Delete run?"
    description="This run and all of its markers and stashed items will be permanently deleted."
    confirm-label="Delete run"
    @update:open="(v) => { if (!v) pendingDeleteRunId = null }"
    @confirm="confirmDeleteRun"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { PlusIcon, SwordsIcon, TrashIcon, PencilIcon } from '@lucide/vue'
import { Dialog, DialogScrollContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Separator } from '~/components/ui/separator'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import { useGameData } from '~/composables/useGameData'
import { cn } from '~/lib/utils'
import type { Difficulty, Run } from '~/types'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { runs, currentRun, markers, addRun, deleteRun, setCurrentRun, updateRun } = useGameData()

const difficulties: Difficulty[] = ['pilgrim', 'voyageur', 'stalker', 'interloper', 'misery']
const newRunName = ref('')
const selectedDifficulty = ref<Difficulty | null>(null)
const pendingDeleteRunId = ref<string | null>(null)

const editingRunId = ref<string | null>(null)
const editName = ref('')
const editDifficulty = ref<Difficulty | null>(null)

function getRunMarkerCount(runId: string) {
  return markers.value.filter((m) => m.runId === runId).length
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDifficultyVariant(diff: Difficulty): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (diff) {
    case 'pilgrim': return 'secondary'
    case 'voyageur': return 'default'
    case 'stalker': return 'default'
    case 'interloper': return 'destructive'
    case 'misery': return 'destructive'
    default: return 'outline'
  }
}

function getDifficultyClasses(diff: Difficulty): string {
  switch (diff) {
    case 'pilgrim':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
    case 'voyageur':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40'
    case 'stalker':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
    case 'interloper':
      return 'bg-red-500/20 text-red-400 border-red-500/40'
    case 'misery':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/40'
    default:
      return 'bg-primary text-primary-foreground border-primary'
  }
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
  editName.value = ''
  editDifficulty.value = null
}

function handleSaveEdit() {
  if (!editingRunId.value || !editName.value.trim() || !editDifficulty.value) return
  updateRun(editingRunId.value, {
    name: editName.value.trim(),
    difficulty: editDifficulty.value,
  })
  cancelEdit()
}

function handleDeleteRun(runId: string) {
  pendingDeleteRunId.value = runId
}

function confirmDeleteRun() {
  if (pendingDeleteRunId.value) {
    deleteRun(pendingDeleteRunId.value)
    pendingDeleteRunId.value = null
  }
}

function handleCreateRun() {
  if (!newRunName.value.trim() || !selectedDifficulty.value) return
  addRun(newRunName.value.trim(), selectedDifficulty.value)
  newRunName.value = ''
  selectedDifficulty.value = null
  emit('update:open', false)
}
</script>
