export type ProfileRebuilder = {
  rebuild(childId: string): Promise<unknown>;
};

export class ProfileRebuildProcessor {
  constructor(private readonly profiles: ProfileRebuilder) {}

  run(payload: { childId: string }): Promise<unknown> {
    return this.profiles.rebuild(payload.childId);
  }
}
