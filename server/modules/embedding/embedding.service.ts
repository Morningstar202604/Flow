import { Injectable, Logger } from '@nestjs/common';

export interface SimilarProduct {
  productId: string;
  similarity: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor() {}

  isReady(): boolean {
    return false;
  }

  async searchSimilarProducts(
    _query: string,
    _language: string,
    _limit: number = 5,
  ): Promise<SimilarProduct[]> {
    return [];
  }

  async upsertProductEmbedding(
    _productId: string,
    _text: string,
    _language: string,
  ): Promise<void> {
    // no-op without external embedding API configured
  }
}
