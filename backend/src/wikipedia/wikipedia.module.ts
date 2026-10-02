import { Module } from "@nestjs/common";
import { WikimediaHttpService } from "./wikimedia-http.service";
import { WikipediaDiseaseSource } from "./wikipedia-disease.source";

@Module({
  providers: [WikimediaHttpService, WikipediaDiseaseSource],
  exports: [WikipediaDiseaseSource],
})
export class WikipediaModule {}
