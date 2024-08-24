<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotebookIcon, InfoIcon } from "lucide-vue-next";
import type { NewItemType } from "~~/server/type";

defineProps<{ items: Partial<NewItemType>[] }>();

const ignoredKeys = [
  "id",
  "locationId",
  "itemId",
  "regionId",
  "createdAt",
  "slug",
  "name",
  "count",
];
</script>

<template>
  <Table>
    <TableCaption>All Items</TableCaption>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Count</TableHead>
        <TableHead>Notes</TableHead>
        <TableHead class="text-right">Other</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="item in items" :key="`${item.locationId}-${item.name}`">
        <TableCell class="font-medium">
          {{ item.name }}
        </TableCell>

        <TableCell>{{ item.count }}</TableCell>

        <TableCell>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="link">
                <NotebookIcon class="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ item.notes || "No notes available" }}
            </TooltipContent>
          </Tooltip>
        </TableCell>

        <TableCell class="text-right">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="link">
                <InfoIcon class="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <ul>
                <li v-for="(value, key) in item" :key="key">
                  <span v-if="!ignoredKeys.includes(key) && value">
                    <strong>{{ key }}</strong>: {{ value }}
                  </span>
                </li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
