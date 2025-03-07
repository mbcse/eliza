export async function postFarcasterReaction({
  reactionType,
  castHash,
  signerUuid,
  neynarApiKey,
}: {
  reactionType: 'like' | 'recast';
  castHash: string;
  signerUuid: string;
  neynarApiKey: string;
}) {
  const url = 'https://api.neynar.com/v2/farcaster/reaction';
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': neynarApiKey,
    },
    body: JSON.stringify({
      reaction_type: reactionType,
      target: castHash,
      signer_uuid: signerUuid,
    }),
  };

  const response = await fetch(url, options);
  const data = await response.json();
  return data as { success: boolean; message: string };
}

export async function getFarcasterCastByUrl(url: string, neynarApiKey: string) {
  const queryUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${url}&type=url`;
  const options = {
    method: 'GET',
    headers: { accept: 'application/json', 'x-api-key': neynarApiKey },
  };

  const response = await fetch(queryUrl, options);
  const data = await response.json();
  return data as { cast: { hash: string; author: { fid: number; username: string } } };
}

export async function getFarcasterCastByHash(hash: string, neynarApiKey: string) {
  const queryUrl = `https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`;
  const options = {
    method: 'GET',
    headers: { accept: 'application/json', 'x-api-key': neynarApiKey },
  };

  const response = await fetch(queryUrl, options);
  const data = await response.json();
  return data as { cast: { hash: string; author: { fid: number; username: string } } };
}

export async function postFarcasterCast({
  text,
  signerUuid,
  neynarApiKey,
}: {
  text: string;
  signerUuid: string;
  neynarApiKey: string;
}) {
  const url = 'https://api.neynar.com/v2/farcaster/cast';
  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-api-key': neynarApiKey,
    },
    body: JSON.stringify({
      text,
      signer_uuid: signerUuid,
    }),
  };

  const response = await fetch(url, options);
  const data = await response.json();
  return data as { success: boolean; cast: { hash: string } };
}
