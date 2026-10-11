import { PushDevicesService } from './push-devices.service';

const installId = '11111111-1111-4111-8111-111111111111';
const token = 'ab'.repeat(32);
const alert = {
  title: 't',
  body: 'b',
  threadId: 'duel-1',
  collapseId: 'duel-1',
  interruptionLevel: 'active' as const,
  relevanceScore: 0.5,
  category: 'postlock.duel',
  data: {},
};

function makeService(device: unknown = { _id: 'd1', token, environment: 'production' }) {
  const devices = {
    deleteMany: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
    updateOne: jest.fn().mockResolvedValue({}),
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(device) }),
  };
  const apns = { send: jest.fn().mockResolvedValue('sent') };
  return { service: new PushDevicesService(devices as never, apns as never), devices, apns };
}

describe('PushDevicesService', () => {
  it('upserts by install and takes the token away from any other install', async () => {
    const { service, devices } = makeService();

    await service.register({ username: 'alice', installId, token, environment: 'sandbox' });

    expect(devices.deleteMany).toHaveBeenCalledWith({ token, installId: { $ne: installId } });
    expect(devices.updateOne).toHaveBeenCalledWith(
      { installId },
      { $set: { username: 'alice', token, environment: 'sandbox' } },
      { upsert: true },
    );
  });

  it('only delivers to an install still registered as that username', async () => {
    const { service, devices, apns } = makeService(null);

    await expect(service.notify(installId, 'alice', alert)).resolves.toBe('skipped');
    expect(devices.findOne).toHaveBeenCalledWith({ installId, username: 'alice' });
    expect(apns.send).not.toHaveBeenCalled();
  });

  it('forgets a token APNs says is gone', async () => {
    const { service, devices, apns } = makeService();
    apns.send.mockResolvedValue('unregistered');

    await service.notify(installId, 'alice', alert);

    expect(devices.deleteOne).toHaveBeenCalledWith({ _id: 'd1' });
  });

  it('keeps the token after a transient failure', async () => {
    const { service, devices, apns } = makeService();
    apns.send.mockResolvedValue('failed');

    await service.notify(installId, 'alice', alert);

    expect(devices.deleteOne).not.toHaveBeenCalled();
  });
});
