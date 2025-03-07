export type MediaData = {
    data: Buffer;
    mediaType: string;
};

export interface Gig {
    id: number;
    created_at: string;
    start_time_ms: number;
    end_time_ms: number;
    duration_ms: number;
    amount: string;
    payout_interval_ms: number;
    how_to_earn: string;
    earning_criteria: string;
    ticker: string;
    gigbot_transactions_id: number;
    platform: string;
    external_url: string;
    token: {
      id: number;
      image_url: string;
      symbol: string;
      coingecko_id: string;
      address: string;
      decimals: number;
    };
    chain: {
      id: number;
      name: string;
      image_url: string;
      chain_id: number;
    };
    gig_type: {
      id: string;
      display: {
        x: DisplayDetails;
        farcaster: DisplayDetails;
      };
    };
  }

  interface DisplayDetails {
    icon: string;
    label: string;
    filter_id: string;
    with_input: boolean;
    how_to_earn: string;
    earning_criteria: string;
    input_placeholder: string;
  }
