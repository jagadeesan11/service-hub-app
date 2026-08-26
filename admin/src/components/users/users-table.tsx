'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createUser, deleteUser, resetPassword, updateUser } from '@/app/(dashboard)/users/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { matchesUserQuery } from '@/lib/user-search';
import type { AppUserWithLogin, UserRole } from '@/types/database';

const ROLE_LABELS: Record<UserRole, string> = {
  shop_owner: 'Shop owner',
  admin: 'Admin',
  technician: 'Technician',
  customer: 'Customer',
};

/** Staff first — this screen exists to manage them, not to browse customers. */
const ROLE_ORDER: UserRole[] = ['shop_owner', 'admin', 'technician', 'customer'];

const ROLE_VARIANTS: Record<UserRole, 'default' | 'secondary' | 'outline' | 'warning'> = {
  shop_owner: 'default',
  admin: 'default',
  technician: 'warning',
  customer: 'outline',
};

const STAFF_ROLES: UserRole[] = ['shop_owner', 'admin', 'technician'];

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * A readable throwaway password: no look-alike characters (0/O, 1/l/I), so it
 * survives being read out over the phone or copied off a screen. Generated
 * from crypto rather than Math.random — a password an admin hands to staff
 * should not be guessable from when it was made.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 14): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

/**
 * Setting a password for someone else, from inside the edit dialog.
 *
 * Separate from the profile form: it is a different kind of change with a
 * different consequence, and putting it behind the same Save button would let
 * someone reset a password while only meaning to fix a phone number.
 */
function PasswordReset({
  user,
  onError,
}: {
  user: AppUserWithLogin;
  onError: (message: string | null) => void;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    onError(null);
    const fd = new FormData();
    fd.set('id', user.id);
    fd.set('password', password);
    const result = await resetPassword(fd);
    setBusy(false);

    if (!result.ok) {
      onError(result.message ?? 'Could not reset the password.');
      return;
    }
    setDone(true);
  }

  return (
    <div className="mt-1 space-y-2 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-medium">Password</p>
        <p className="text-xs text-muted-foreground">
          Sets a new password immediately. They are not notified — tell them yourself.
        </p>
      </div>

      <div className="flex gap-1.5">
        <Input
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setDone(false);
          }}
          // Plain text, not a password field: the admin has to read this out
          // to someone, and masking it would only make that harder.
          type="text"
          autoComplete="off"
          placeholder="At least 8 characters"
          className="h-8"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setPassword(generatePassword());
            setDone(false);
          }}
        >
          Generate
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || password.length < 8}
          onClick={() => void submit()}
        >
          {busy ? 'Setting…' : 'Set password'}
        </Button>
        {done && (
          <span className="text-xs text-success">
            Password changed. Give them this one before you close.
          </span>
        )}
      </div>
    </div>
  );
}

function RoleSelect({ name, value }: { name: string; value: UserRole }) {
  const [role, setRole] = useState<UserRole>(value);
  return (
    <>
      <input type="hidden" name={name} value={role} />
      <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
        <SelectTrigger className="w-full">
          <SelectValue>{(v: UserRole) => ROLE_LABELS[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLE_ORDER.map((r) => (
            <SelectItem key={r} value={r}>
              {ROLE_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export function UsersTable({
  users,
  currentUserId,
}: {
  users: AppUserWithLogin[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // "Which user" is kept separate from "is the dialog open". Clearing the user
  // to close the dialog emptied its contents first, leaving a blank box on
  // screen — and inside a transition the close did not always land at all.
  const [editing, setEditing] = useState<AppUserWithLogin | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [removing, setRemoving] = useState<AppUserWithLogin | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | UserRole>('all');

  const sorted = [...users].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
  const staffCount = users.filter((u) => STAFF_ROLES.includes(u.role)).length;

  const filtered = sorted.filter((user) => {
    const roleOk =
      roleFilter === 'all'
        ? true
        : roleFilter === 'staff'
          ? STAFF_ROLES.includes(user.role)
          : user.role === roleFilter;
    return roleOk && matchesUserQuery(user, query);
  });

  const isFiltered = query.trim() !== '' || roleFilter !== 'all';

  async function run(
    action: (fd: FormData) => Promise<{ ok: boolean; message?: string }>,
    fd: FormData,
    done: () => void,
  ) {
    setPending(true);
    setError(null);
    const result = await action(fd);
    setPending(false);

    if (!result.ok) {
      setError(result.message ?? 'Something went wrong.');
      return;
    }
    done();
    // The action revalidated the cache; this pulls the fresh rows in.
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {isFiltered ? (
            <>
              Showing {filtered.length} of {users.length}
            </>
          ) : (
            <>
              {staffCount} staff {staffCount === 1 ? 'account' : 'accounts'} ·{' '}
              {users.length - staffCount} customers
            </>
          )}
        </p>
        <Button size="sm" onClick={() => setAdding(true)}>
          Add user
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or phone"
          aria-label="Search users"
          className="sm:max-w-xs"
        />

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'Everyone'],
              ['staff', 'Staff'],
              ['customer', 'Customers'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRoleFilter(key)}
              aria-pressed={roleFilter === key}
              className={
                roleFilter === key
                  ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
                  : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted'
              }
            >
              {label}
            </button>
          ))}

          {isFiltered && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRoleFilter('all');
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Signs in with</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
              <TableHead className="w-px text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {isFiltered ? "No one matches that search." : "No users yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name ?? <span className="text-muted-foreground">Unnamed</span>}
                      {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell>
                      {/* The account identity, which is what a role change
                          actually applies to. Customers sign up by phone and
                          have no login email at all. */}
                      {user.login_email || user.login_phone || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {[user.email, user.phone].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANTS[user.role] ?? 'outline'}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {DATE.format(new Date(user.created_at))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => { setEditing(user); setEditOpen(true); }}>
                          Edit
                        </Button>
                        {/* Deleting yourself would lock you out mid-session, so
                            the control is not offered at all. */}
                        {!isSelf && (
                          <Button size="sm" variant="destructive" onClick={() => { setRemoving(user); setRemoveOpen(true); }}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* add ------------------------------------------------------------ */}
      <Dialog open={adding} onOpenChange={(v) => { setAdding(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(createUser, new FormData(e.currentTarget), () => setAdding(false));
            }}
          >
            <DialogHeader>
              <DialogTitle>Add a user</DialogTitle>
              <DialogDescription>
                They can sign in immediately with this email and password — no confirmation email is
                sent. Tell them the password yourself and ask them to change it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <div>
                <Label htmlFor="new-name" className="mb-1.5">Name</Label>
                <Input id="new-name" name="name" />
              </div>
              <div>
                <Label htmlFor="new-email" className="mb-1.5">Email</Label>
                <Input id="new-email" name="email" type="email" required autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="new-password" className="mb-1.5">Password</Label>
                <Input
                  id="new-password"
                  name="password"
                  type="text"
                  required
                  minLength={8}
                  autoComplete="off"
                  placeholder="At least 8 characters"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown rather than masked, so you can read it out to them.
                </p>
              </div>
              <div>
                <Label htmlFor="new-phone" className="mb-1.5">Phone</Label>
                <Input id="new-phone" name="phone" placeholder="+91 98765 43210" />
              </div>
              <div>
                <Label className="mb-1.5">Role</Label>
                <RoleSelect name="role" value="technician" />
              </div>
            </div>

            {error && <p className="pb-2 text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* edit ----------------------------------------------------------- */}
      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(updateUser, new FormData(e.currentTarget), () => setEditOpen(false));
              }}
            >
              <input type="hidden" name="id" value={editing.id} />
              <DialogHeader>
                <DialogTitle>Edit {editing.name || editing.login_email || editing.login_phone || 'user'}</DialogTitle>
                <DialogDescription>
                  Changing a role takes effect the next time they load the panel.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-3">
                <div>
                  <Label htmlFor="edit-name" className="mb-1.5">Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editing.name ?? ''} />
                </div>
                <div>
                  <Label htmlFor="edit-phone" className="mb-1.5">Phone</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editing.phone ?? ''} />
                </div>
                <div>
                  <Label className="mb-1.5">Role</Label>
                  <RoleSelect name="role" value={editing.role} />
                </div>

                <PasswordReset user={editing} onError={setError} />
              </div>

              {error && <p className="pb-2 text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* delete --------------------------------------------------------- */}
      <Dialog open={removeOpen} onOpenChange={(v) => { setRemoveOpen(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-md">
          {removing && (
            <>
              <DialogHeader>
                <DialogTitle>Delete this account?</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">
                    {removing.name || removing.login_email || removing.login_phone}
                  </span>{' '}
                  will no longer be able to sign in. A customer with completed jobs cannot be
                  deleted, because their bills have to be kept.
                </DialogDescription>
              </DialogHeader>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <DialogFooter>
                <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={pending}>
                  Keep account
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set('id', removing.id);
                    void run(deleteUser, fd, () => setRemoveOpen(false));
                  }}
                >
                  {pending ? 'Deleting…' : 'Delete account'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
