<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { Location } from "~~/server/type";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronRight } from "lucide-vue-next";

defineProps<{ location: Location }>();
</script>

<template>
  <Dialog>
    <DialogTrigger as-child>
      <Button variant="outline" size="icon">
        <ChevronRight class="size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle autoFocus :tabIndex="0">{{ location.name }}</DialogTitle>
        <DialogDescription>
          All items in {{ location.name }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <ItemTable :items="location.items" />
      </div>
    </DialogContent>
  </Dialog>
</template>
