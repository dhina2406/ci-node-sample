pipeline {
  agent any

  environment {
    SONAR_TOKEN = credentials('sonar-token')        // SonarCloud token (secret text)
    DOCKERHUB_CREDENTIALS = 'dockerhub-creds'       // DockerHub credentials id
    DOCKERHUB_REPO = 'dhina2406/ci-node-sample'     // Docker Hub repo
  }

  options {
    buildDiscarder(logRotator(daysToKeepStr: '7', numToKeepStr: '10'))
    timestamps()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Test') {
      steps {
        script {
          if (isUnix()) {
            sh 'npm ci'
            sh 'npm test'
          } else {
            bat 'npm ci'
            bat 'npm test'
          }
        }
      }
    }

    stage('SonarCloud Analysis') {
      steps {
        script {
          def scannerHome = tool 'SonarScanner'
          withSonarQubeEnv('SonarCloud') {
            if (isUnix()) {
              sh """
                ${scannerHome}/bin/sonar-scanner \
                -Dsonar.projectKey=dhina2406_ci-node-sample \
                -Dsonar.organization=dhina2406 \
                -Dsonar.sources=. \
                -Dsonar.login=${SONAR_TOKEN}
              """
            } else {
              bat """
                "${scannerHome}\\bin\\sonar-scanner.bat" ^
                -Dsonar.projectKey=dhina2406_ci-node-sample ^
                -Dsonar.organization=dhina2406 ^
                -Dsonar.sources=. ^
                -Dsonar.login=%SONAR_TOKEN%
              """
            }
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        script {
          timeout(time: 5, unit: 'MINUTES') {
            waitForQualityGate abortPipeline: true
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        script {
          try {
            def imageTag = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
            if (isUnix()) {
              def img = docker.build(imageTag)
              env.IMAGE_TAG = imageTag
            } else {
              bat "docker build -t ${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER} ."
              env.IMAGE_TAG = "${env.DOCKERHUB_REPO}:${env.BUILD_NUMBER}"
            }
          } catch (err) {
            error "Docker build failed or Docker not available on this agent: ${err}"
          }
        }
      }
    }

    stage('Docker Push') {
      steps {
        script {
          try {
            docker.withRegistry('https://index.docker.io/v1/', DOCKERHUB_CREDENTIALS) {
              def img = docker.image("${env.IMAGE_TAG}")
              img.push()
            }
          } catch (err) {
            if (isUnix()) {
              sh "docker push ${env.IMAGE_TAG}"
            } else {
              bat "docker push ${env.IMAGE_TAG}"
            }
          }
        }
      }
    }

    stage('Deploy (local)') {
      steps {
        script {
          try {
            if (isUnix()) {
              sh "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
            } else {
              bat "docker run -d --rm -p 3000:3000 --name ci_node_${env.BUILD_NUMBER} ${env.IMAGE_TAG}"
            }
          } catch (err) {
            echo "Deploy step skipped/failed (Docker may not be available): ${err}"
          }
        }
      }
    }
  }

  post {
    success { echo "Pipeline completed successfully!" }
    failure { echo "Pipeline failed!" }
    always { echo "Build ${env.BUILD_NUMBER} finished with status ${currentBuild.currentResult}" }
  }
}
