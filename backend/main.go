package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/kkdai/youtube/v2"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	ffmpeg "github.com/u2takey/ffmpeg-go"
)

const BucketName = "karaoke-raw-wav"

type InputYoutubeDownloadSchema struct {
	SongName   string `json:"song_name" binding:"required"`
	AuthorName string `json:"author_name" binding:"required"`
	Link       string `json:"link" binding:"required"`
}

func downloadAudioHandler(c *gin.Context) {
	var data InputYoutubeDownloadSchema

	c.BindJSON(&data)
	objectName := fmt.Sprintf("%s-%s", data.AuthorName, data.SongName)
	client := youtube.Client{}
	video, err := client.GetVideo(data.Link)
	if err != nil {
		log.Fatalf("Error fetching video: %v", err)
	}

	format := video.Formats.WithAudioChannels()[0]
	stream, _, err := client.GetStream(video, &format)
	if err != nil {
		log.Fatalf("Error getting stream: %v", err)
	}

	var inputBuffer bytes.Buffer
	_, err = io.Copy(&inputBuffer, stream)
	if err != nil {
		log.Fatalf("Failed to copy stream: %v", err)
	}
	// Step 2: Convert to WAV in memory
	var outputBuffer bytes.Buffer
	err = ffmpeg.
		Input("pipe:0").
		Output("pipe:1", ffmpeg.KwArgs{
			"f":  "wav",
			"ar": "44100", // Sample rate for processing
			"ac": "1",     // Mono (better for whisper, demucs, etc.)
		}).
		WithInput(&inputBuffer).
		WithOutput(&outputBuffer).
		Run()
	if err != nil {
		log.Fatalf("FFmpeg conversion failed: %v", err)
	}

	// Step 3: Upload to MinIO
	minioClient, err := minio.New("127.0.0.1:9000", &minio.Options{
		Creds:  credentials.NewStaticV4("minioadmin", "minioadmin123", ""),
		Secure: false,
	})
	if err != nil {
		log.Fatalf("MinIO connection failed: %v", err)
	}

	ctx := context.Background()
	exists, err := minioClient.BucketExists(ctx, BucketName)
	if err != nil {
		log.Fatal(err)
	}
	if !exists {
		err := minioClient.MakeBucket(ctx, BucketName, minio.MakeBucketOptions{})
		if err != nil {
			log.Fatal(err)
		}
	}

	_, err = minioClient.PutObject(ctx, BucketName, objectName, &outputBuffer, int64(outputBuffer.Len()), minio.PutObjectOptions{
		ContentType: "audio/wav",
	})
	if err != nil {
		log.Fatalf("Failed to upload to MinIO: %v", err)
	}

	fmt.Println("✅ Uploaded WAV to MinIO:", objectName)
}

func main() {
	r := gin.Default()
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})
	r.POST("/upload_youtube", downloadAudioHandler)
	r.Run() // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}
