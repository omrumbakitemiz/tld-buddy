<script setup lang="ts">
import { Map, Bird, Book, Pickaxe, CookingPot, LifeBuoy, Rabbit, Settings, Settings2, Share, SquareUser, Triangle, Turtle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
</script>

<template>
  <main>
    <div class="grid w-full pl-[53px]">
      <aside class="inset-y fixed  left-0 z-20 flex h-full flex-col border-r">
        <div class="border-b p-2">
          <NuxtLink to="/">
            <Button variant="outline" size="icon" aria-label="Home">
              <Triangle class="size-5 fill-foreground" />
            </Button>
          </NuxtLink>
        </div>
        <nav class="grid gap-1 p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <NuxtLink to="/regions">
                  <Button variant="ghost" size="icon" class="rounded-lg bg-muted" aria-label="Playground">
                    <Map class="size-5" />
                  </Button>
                </NuxtLink>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Regions
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <NuxtLink to="/items">
                  <Button variant="ghost" size="icon" class="rounded-lg" aria-label="Models">
                    <Pickaxe class="size-5" />
                  </Button>
                </NuxtLink>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Items
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="rounded-lg" aria-label="API">
                  <CookingPot class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Food
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="ghost" size="icon" class="rounded-lg" aria-label="Documentation">
                  <Book class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Notes
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button disabled variant="ghost" size="icon" class="rounded-lg" aria-label="Settings">
                  <Settings2 class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Settings
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
        <nav class="mt-auto grid gap-1 p-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button disabled variant="ghost" size="icon" class="mt-auto rounded-lg" aria-label="Help">
                  <LifeBuoy class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Help
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button disabled variant="ghost" size="icon" class="mt-auto rounded-lg" aria-label="Account">
                  <SquareUser class="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" :side-offset="5">
                Account
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </nav>
      </aside>
      <div class="flex flex-col">
        <header class="sticky top-0 z-10 flex h-[53px] items-center gap-1 border-b bg-background px-4">
          <h1 class="text-xl font-semibold">
            The Long Dark Buddy
          </h1>
          <Drawer>
            <DrawerTrigger as-child>
              <Button variant="ghost" size="icon" class="md:hidden">
                <Settings class="size-4" />
                <span class="sr-only">Settings</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent class="max-h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>Configuration</DrawerTitle>
                <DrawerDescription>
                  Configure the settings for the model and messages.
                </DrawerDescription>
              </DrawerHeader>
              <form class="grid w-full items-start gap-6 overflow-auto p-4 pt-0">
                <fieldset class="grid gap-6 rounded-lg border p-4">
                  <legend class="-ml-1 px-1 text-sm font-medium">
                    Settings
                  </legend>
                  <div class="grid gap-3">
                    <Label for="model">Model</Label>
                    <Select>
                      <SelectTrigger id="model" class="items-start [&_[data-description]]:hidden">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="genesis">
                          <div class="flex items-start gap-3 text-muted-foreground">
                            <Rabbit class="size-5" />
                            <div class="grid gap-0.5">
                              <p>
                                Neural
                                <span class="font-medium text-foreground">
                                  Genesis
                                </span>
                              </p>
                              <p class="text-xs" data-description>
                                Our fastest model for general use cases.
                              </p>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="explorer">
                          <div class="flex items-start gap-3 text-muted-foreground">
                            <Bird class="size-5" />
                            <div class="grid gap-0.5">
                              <p>
                                Neural
                                <span class="font-medium text-foreground">
                                  Explorer
                                </span>
                              </p>
                              <p class="text-xs" data-description>
                                Performance and speed for efficiency.
                              </p>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="quantum">
                          <div class="flex items-start gap-3 text-muted-foreground">
                            <Turtle class="size-5" />
                            <div class="grid gap-0.5">
                              <p>
                                Neural
                                <span class="font-medium text-foreground">
                                  Quantum
                                </span>
                              </p>
                              <p class="text-xs" data-description>
                                The most powerful model for complex
                                computations.
                              </p>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid gap-3">
                    <Label for="temperature">Temperature</Label>
                    <Input id="temperature" type="number" placeholder="0.4" />
                  </div>
                  <div class="grid gap-3">
                    <Label for="top-p">Top P</Label>
                    <Input id="top-p" type="number" placeholder="0.7" />
                  </div>
                  <div class="grid gap-3">
                    <Label for="top-k">Top K</Label>
                    <Input id="top-k" type="number" placeholder="0.0" />
                  </div>
                </fieldset>
                <fieldset class="grid gap-6 rounded-lg border p-4">
                  <legend class="-ml-1 px-1 text-sm font-medium">
                    Messages
                  </legend>
                  <div class="grid gap-3">
                    <Label for="role">Role</Label>
                    <Select default-value="system">
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">
                          System
                        </SelectItem>
                        <SelectItem value="user">
                          User
                        </SelectItem>
                        <SelectItem value="assistant">
                          Assistant
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="grid gap-3">
                    <Label for="content">Content</Label>
                    <Textarea id="content" placeholder="You are a..." />
                  </div>
                </fieldset>
              </form>
            </DrawerContent>
          </Drawer>
          <Button variant="outline" size="sm" class="ml-auto gap-1.5 text-sm">
            <Share class="size-3.5" />
            Share
          </Button>
          <ClientOnly>
            <ThemeToggle />
          </ClientOnly>
        </header>
        <main class="container">
          <slot />
        </main>
      </div>
    </div>
  </main>
</template>
