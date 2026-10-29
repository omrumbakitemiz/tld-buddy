<template>
  <div
    v-if="unlinkedSave"
    class="relative z-[650] flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary/30 bg-accent px-3 py-2 text-sm text-foreground"
    role="status"
  >
    <Gamepad2Icon class="size-4 shrink-0 text-primary" />
    <p class="min-w-0 flex-1">
      You're playing <span class="font-medium">{{ saveLabel }}</span><template v-if="unlinkedSave.mode"> ({{ unlinkedSave.mode }})</template>.
      Pick its run: TLD Buddy then opens that run whenever you play this save, and what you do in game goes there.
    </p>
    <div class="flex shrink-0 gap-2">
      <Button v-if="currentRun && !currentRun.gameSave" size="sm" variant="outline" @click="linkCurrent">Use {{ currentRun.name }}</Button>
      <Button size="sm" @click="startRun">
        <PlusIcon class="size-4" /> New run
      </Button>
      <Button size="sm" variant="ghost" @click="dismissed = unlinkedSave.id">Not now</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Gamepad2Icon, PlusIcon } from '@lucide/vue'
import { Button } from '~/components/ui/button'
import { useAddUi } from '~/composables/useAddUi'
import { useGameData } from '~/composables/useGameData'
import { useLiveGame } from '~/composables/useLiveGame'
import { difficultyForMode } from '#shared/utils/live'

const live = useLiveGame()
const { runs, currentRun, addRun, linkRunToSave, apiSynced } = useGameData()
const addUi = useAddUi()

/** Save id the player said "not now" to, for this page load. */
const dismissed = ref<string | null>(null)

const unlinkedSave = computed(() => {
  const save = live.save.value
  if (!save || !apiSynced.value || save.id === dismissed.value) return null
  return runs.value.some((r) => r.gameSave === save.id) ? null : save
})

const saveLabel = computed(() => unlinkedSave.value?.name || 'a save without a name')

function linkCurrent() {
  if (!unlinkedSave.value || !currentRun.value) return
  linkRunToSave(currentRun.value.id, unlinkedSave.value.id)
  addUi.announce(`${currentRun.value.name} now follows this save`)
}

function startRun() {
  const save = unlinkedSave.value
  if (!save) return
  // Custom and challenge modes have no difficulty of their own: keep the current run's (editable in Runs)
  const difficulty = difficultyForMode(save.mode) ?? currentRun.value?.difficulty ?? 'voyageur'
  const run = addRun(save.name || 'New run', difficulty, save.id)
  addUi.announce(`Started ${run.name}, linked to this save`)
}
</script>
