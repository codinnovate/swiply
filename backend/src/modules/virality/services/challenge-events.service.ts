import { Injectable } from '@nestjs/common';
import { filter, map, Subject, type Observable } from 'rxjs';

/**
 * In-process fan-out for posting-challenge changes, plus the set of usernames
 * with an open challenge stream so the watcher only polls duels someone is
 * looking at. Single-instance by design: with more than one backend replica,
 * this needs a shared bus (e.g. Redis pub/sub) instead.
 */
@Injectable()
export class ChallengeEventsService {
  private readonly changes = new Subject<string[]>();
  private readonly watchers = new Map<string, number>();

  /** Announces that challenges involving these usernames changed. */
  changed(...usernames: string[]): void {
    if (usernames.length > 0) this.changes.next(usernames);
  }

  changesFor(username: string): Observable<void> {
    return this.changes.pipe(
      filter((usernames) => usernames.includes(username)),
      map(() => undefined),
    );
  }

  /** Registers an open stream for a username; call the returned function when it closes. */
  watch(username: string): () => void {
    this.watchers.set(username, (this.watchers.get(username) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.watchers.get(username) ?? 1) - 1;
      if (remaining > 0) this.watchers.set(username, remaining);
      else this.watchers.delete(username);
    };
  }

  watchedUsernames(): string[] {
    return [...this.watchers.keys()];
  }
}
